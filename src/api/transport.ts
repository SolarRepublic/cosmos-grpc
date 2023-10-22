import type {Dict, JsonObject} from '@blake.regalia/belt';

import {safe_json} from '@blake.regalia/belt';

export type RpcRequest<
	a_args extends any[]=[],
> = (...a_args: a_args) => [string] | [string, Dict<string | undefined>];

export const F_RPC_REQ_NO_ARGS: RpcRequest = () => [''];

export type NetworkErrorDetails = [
	d_res: Response,
	sx_res: string,
	g_res?: JsonObject,
];

// export const query_error = (a_details: NetworkErrorDetails) => {
// 	Object.assign(Error('Query'), {
// 		d: a_details,
// 	});
// };

/**
 * Submits a query to the RESTful gRPC-gateway endpoint
 * @param f_req - the {@link RpcRequest `RpcRequest`}
 * @param f_res - a response-processing callback
 * @param g_init - optional {@link RequestInit} object
 * @returns what `f_res` returned
 * @throws a tuple of `[Response, string, JsonObject?]` where:
 * 	- 0: d_res - the {@link Response `Response`} object
 * 	- 1: s_res - the response body as text
 *    - 2?: g_res - the parsed response response JSON if valid
*/
export const restful_grpc = <
	a_args extends any[],
	w_parsed,
>(
	f_req: RpcRequest<a_args>,
	f_res: (g_response: any) => w_parsed,
	g_init?: 1 | RequestInit
) => async(z_req: string | {origin: string} & RequestInit, ...a_args: a_args): Promise<w_parsed> => {
	let [sr_append, h_args] = f_req(...a_args);

	// convert to POST request
	if(1 === g_init) g_init = {method:'POST'};

	// normalize origin and request init
	let p_origin = z_req as string;
	if('string' !== typeof z_req) {
		p_origin = z_req.origin;
		g_init = {...z_req, ...g_init};
	}

	// args are defined
	if(h_args) {
		// remove `undefined` values from args by round-trip (de)serializing as JSON, then append to query params
		sr_append += '?'+new URLSearchParams(JSON.parse(JSON.stringify(h_args)) as Dict);
	}

	// submit request
	const d_res = await fetch(p_origin+sr_append, g_init);

	// resolve as text
	const sx_res = await d_res.text();

	// parse json
	const g_res = safe_json<JsonObject>(sx_res);

	// not json
	// eslint-disable-next-line no-throw-literal
	if(!g_res) throw [d_res, sx_res] as NetworkErrorDetails;

	// response error or network error
	// eslint-disable-next-line no-throw-literal
	if(!d_res.ok || g_res['code']) throw [d_res, sx_res, g_res] as NetworkErrorDetails;

	// process response
	return f_res(g_res);
};
