import type {Promisable} from '@blake.regalia/belt';

import type {TrustedContextUrl} from '@solar-republic/types';

import {__UNDEFINED, is_number, is_string, is_undefined, timeout, try_async} from '@blake.regalia/belt';

type RequestInfo = Parameters<typeof fetch>[0];

export type RequestDescriptor =
	| TrustedContextUrl
	| URL
	| ({origin: TrustedContextUrl} & RequestInit);

export type CosmosClient = {
	debug?: string;
	fetch: (sr_append: string, g_append?: RequestInit) => Promise<Response>;
};

export type RetryableRequestWrapper = ((z_req: RequestInfo | URL, z_init: RequestInit | undefined, i_attempt: number) => Promise<Response | RetryParams>);

type RequestParams =
	| RequestDescriptor
	| RetryableRequestWrapper
	;

type RetryParams = Promisable<undefined | boolean | number | [
	xt_wait: number,
]>;

type RetryHandler = (e_fail: unknown, i_retry: number) => RetryParams;

export type ExpoentialBackoffParams = [
	xt_backoff?: number,
	xt_maximum?: number,
	n_max_attempts?: number,
	x_growth?: number,
];

export const exponential_backoff = ([
	xt_backoff=0,
	xt_maximum=Infinity,
	n_max_attempts=Infinity,
	x_growth=2,
]: ExpoentialBackoffParams) => (i_attempt: number) => i_attempt >= n_max_attempts
	? __UNDEFINED
	: Math.min(xt_maximum, xt_backoff * (x_growth ** i_attempt));

export type ResponseChecker = (a_backoff?: ExpoentialBackoffParams) => ((d_res: Response, i_retry: number) => RetryParams);

export const response_is_429: ResponseChecker = (
	a_backoff=[],
	f_backoff=exponential_backoff(a_backoff)
) => (d_res, i_retry) => 429 === d_res.status
	? f_backoff(i_retry)
	: false;

export const response_is_5xx: ResponseChecker = (
	a_backoff=[],
	f_backoff=exponential_backoff(a_backoff)
) => (d_res, i_retry, xc_status=d_res.status) => xc_status >= 500 && xc_status < 600
	? f_backoff(i_retry)
	: false;

export const response_is_429_or_5xx: ResponseChecker = (
	a_backoff=[],
	f_backoff=exponential_backoff(a_backoff)
) => (d_res, i_retry, xc_status=d_res.status) => 429 === xc_status || (xc_status >= 500 && xc_status < 600)
	? f_backoff(i_retry)
	: false;



export const retry_when_response = (
	f_test: (d_res: Response, i_retry: number) => RetryParams
): RetryableRequestWrapper => async(z_req, z_init, i_retry) => {
	// attempt request
	const d_res = await fetch(z_req, z_init);

	// check if retry is needed
	return await f_test(d_res, i_retry);
};

/**
 * Creates and returns a function that implements `fetch` but with the ability to automatically retry
 * on certain exceptions or responses, with optional exponential backoff.
 * @param z_desc - the request descriptor, see {@link RequestDescriptor}
 * @param f_retry - an optional retry handler to be used when fetch function throws, see {@link RetryHandler}
 * @returns a function idential to `fetch`
 */
export const retryable_fetcher = (
	z_desc?: RetryableRequestWrapper | undefined,
	f_retry?: RetryHandler
): (typeof fetch) => async(z_req, z_init) => {
	// attempt counter
	let c_attempts = 0;

	// retry loop
	for(;;) {
		// attempt the request
		// eslint-disable-next-line @typescript-eslint/no-loop-func
		const [z_res, e_fail] = await try_async(() => (z_desc ?? fetch)(z_req, z_init, c_attempts));

		// determine if retry is needed
		const z_retry = e_fail
			// request failed, ask for retry
			? await f_retry?.(e_fail, c_attempts++) || 0
			// user returned retry params
			: !(z_res instanceof Response)
				// retry with returned params
				? z_res
				// do not retry
				: __UNDEFINED;

		// retry wanted
		if(!is_undefined(z_retry)) {
			// wait for given time
			await timeout(is_number(z_retry)? z_retry: 0);

			// retry
			continue;
		}

		// throw error
		if(e_fail) throw e_fail;

		// done
		return z_res as Response;
	}
};



/**
 * Convenience method for creating a basic fetcher that retries on 429 and 5xx with exponential backoff.
 * If exponential backoff params are omitted, fetcher defaults to waiting up to 30 seconds maximum between
 * retries, with a backoff param of 200ms, allowing up to 10 attempts in total.
 * @param a_backoff 
 * @returns 
 */
export const basic_retryable_fetcher = (a_backoff: ExpoentialBackoffParams=[200, 30e3, 10]) => retryable_fetcher(retry_when_response(response_is_429_or_5xx(a_backoff)));



export const direct_cosmos_client = (
	z_desc: RequestDescriptor,
	f_fetcher: typeof fetch=basic_retryable_fetcher()
): CosmosClient => {
	// prep request init object
	let g_init: RequestInit | undefined;

	// deduce origin
	const p_origin = is_string(z_desc)
		? z_desc.replace(/\/+$/, '')
		: z_desc instanceof URL
			? z_desc.origin+z_desc.pathname
			: (g_init=z_desc, z_desc.origin);

	// return client struct
	return {
		debug: `direct:<${p_origin}>`,
		fetch: (sr_append: string, g_ammend?: RequestInit) => f_fetcher(p_origin+sr_append, {...g_init, ...g_ammend}),
	};
};

export const pooling_cosmos_client = (
	a_clients: [
		y_client: CosmosClient,
		xt_recovery?: number | undefined,
		n_max_conn?: number | undefined,
	][]
): CosmosClient => {
	// form connection details from clients list
	const a_conns: [
		n_available: number,
		i_offline: number,
	][] = a_clients.map(([y, n]) => [n ?? Infinity, 0]);

	// return client struct
	return {
		debug: `pool:<${a_clients.map(([y]) => y.debug).join(',')}>`,
		async fetch(sr_append: string, g_ammend?: RequestInit) {
			// find an available client
			let i_client = 0;
			for(; i_client<a_clients.length-1;) {
				// destructure connection details
				const [n_available, i_offline] = a_conns[i_client++];

				// found available client
				if(!i_offline && n_available > 0) break;
			}

			// destructure client
			const [y_client, xt_recovery] = a_clients[i_client];

			// ref connection data
			const a_conn = a_conns[i_client];

			// remove client from pool
			a_conn[0]--;

			// attempt request
			const [d_res, e_lcd] = await try_async(() => y_client.fetch(sr_append, g_ammend));

			// return client to pool
			a_conn[0]++;

			// error
			if(e_lcd) {
				// reached ultimate fallback client
				if(i_client === a_clients.length-1) throw e_lcd;

				// cancel previous timeout
				clearTimeout(a_conn[1]);

				// mark client as offline
				a_conn[1] = setTimeout(() => {
					// reset offline status
					a_conn[1] = 0;
				}, xt_recovery || 5e3) as unknown as number;

				// retry
				return await this.fetch(sr_append, g_ammend);
			}

			// return response
			return d_res!;
		},
	};
};

const f_fetcher = basic_retryable_fetcher([200, 30e3, 5]);

pooling_cosmos_client(([
	['http://10.0.0.23:26657', 5e3, 16],
	['https://ss1-secret.lavenderfive.com', 5e3],
] as const).map(([p_url, xt_recovery, n_max]) => [direct_cosmos_client(p_url, f_fetcher), xt_recovery, n_max]));

const y_client = direct_cosmos_client('http://10.0.0.23:26657');

// queryCosmosAuthAccount(y_client);