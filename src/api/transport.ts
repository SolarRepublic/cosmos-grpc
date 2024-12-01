/* eslint-disable prefer-const */
import type {Nilable, JsonObject, JsonValue} from '@blake.regalia/belt';

import type {SlimCoin} from '@solar-republic/types';

import {bytes_to_base64, __UNDEFINED, is_array, parse_json_safe, entries, is_object, is_function} from '@blake.regalia/belt';

import {direct_cosmos_client, type CosmosClient, type RequestDescriptor} from './client';

type Voidable = void | undefined;

export type RpcRequest<
	a_args extends any[]=[],
> = (...a_args: a_args) => [string] | [string, JsonObject<Voidable | Uint8Array>];

export const F_RPC_REQ_NO_ARGS: RpcRequest = () => [''];

/**
 * Response wrapper tuple where:
 *  - 0: g_res - parsed response body JSON on OK response code
 *  - 1: g_err - parsed response body JSON on non-OK response code
 *  - 2: d_res - the {@link Response}
 *  - 3: sx_res - response body text
 */
export type NetworkJsonResponse<
	w_type extends JsonValue<Voidable>=JsonValue | undefined,
	w_err extends JsonValue<Voidable>=JsonValue | undefined,
> = [
	g_res: w_type,
	g_err: w_err,
	d_res: Response,
	sx_res: string,
];

/**
 * Returned when a query error occurred
 */
export type CosmosQueryErrorResult = {
	code: number;
	details: string[];
	message: string;
};

const json_to_flatdot = (
	w_value: JsonValue<Voidable | Uint8Array>,
	a_entries: [string, string][],
	sr_path: string
): void => {
	if(is_array(w_value)) {
		// eslint-disable-next-line array-callback-return
		w_value.map((w_item, i_item) => {
			// in grpc-gateway, repeated fields simply repeat the url param key instead of `${sr_path}[${i_item}]`
			json_to_flatdot(w_item, a_entries, sr_path);
		});
	}
	else if(ArrayBuffer.isView(w_value)) {
		a_entries.push([sr_path, bytes_to_base64(w_value)]);
	}
	else if(is_object(w_value)) {
		json_object_to_flatdot(w_value as JsonObject, a_entries, sr_path);
	}
	else {
		// do not encode URI component here, allow transport to do escaping
		a_entries.push([sr_path, w_value+'']);
	}
};

/**
 * Converts a JSON object to a 'flatdot' notation dict for use in URL query params.
 * 
 * For example,
 * ```
 * {
 *   "foo": {
 *     "bar": [25, 42]
 *   }
 * }
 * ```
 * 
 * becomes:
 * ```
 * [
 *   ["foo.bar", "25"],
 *   ["foo.bar": "42"],
 * ]
 * ```
 */
const json_object_to_flatdot = (
	h_object: JsonObject<Voidable | Uint8Array>,
	a_entries: [string, string][]=[],
	sr_path=''
): [string, string][] => {
	for(const [si_key, w_value] of entries(h_object)) {
		// anything falsy is default, skip it
		if(!w_value) continue;

		// encode
		json_to_flatdot(w_value as JsonObject<Uint8Array>, a_entries, (sr_path? sr_path+'.': '')+si_key);
	}

	return a_entries;
};


/**
 * @param f_req - the {@link RpcRequest `RpcRequest`}
 * @param f_res - a response-processing callback
 * @param g_init - optional {@link RequestInit} object
 * @returns what `f_res` returned
 * @throws a tuple of `[Response, string, JsonObject?]` where:
 * 	- 0: d_res - the {@link Response `Response`} object
 * 	- 1: s_res - the response body as text
 *    - 2?: g_res - the parsed response response JSON if valid
*/

/**
 * Constructs a function that submits a query/submit to the RESTful gRPC-gateway endpoint
 * @param f_req 
 * @param g_init 
 * @returns request function
 */
export const restful_grpc = <
	a_args extends any[],
	w_parsed extends JsonValue<Voidable>,
>(
	f_req: RpcRequest<a_args>,
	g_init_default?: 1 | RequestInit
) => async(
	z_req: RequestDescriptor | CosmosClient,
	...a_args: a_args
): Promise<NetworkJsonResponse<w_parsed | undefined, CosmosQueryErrorResult | undefined>> => {
	// set default init object
	let g_init = g_init_default;

	// retrieve args
	let [sr_append, h_args] = f_req(...a_args);

	// indicated submit action
	if(1 === g_init) {
		// replace init object
		g_init = {
			// convert to POST request
			method: 'POST',

			// args were supplied; convert to JSON-encoded body
			...h_args? {
				body: JSON.stringify(h_args),
			}: {},
		};
	}
	// query action, args are defined
	else if(h_args) {
		// encode json to flatdot, then to search params
		sr_append += '?'+new URLSearchParams(json_object_to_flatdot(h_args));
	}

	// cosmos client
	const y_client = is_function((z_req as CosmosClient).fetch)
		? z_req as CosmosClient
		: direct_cosmos_client(z_req as RequestDescriptor);

	// submit request
	const d_res = await y_client.fetch(sr_append, g_init);

	// resolve as text
	const sx_res = await d_res.text();

	// attempt to parse json
	const g_res = parse_json_safe<w_parsed>(sx_res);

	// response tuple
	return d_res.ok
		? [g_res, __UNDEFINED, d_res, sx_res]
		: [__UNDEFINED, g_res as CosmosQueryErrorResult, d_res, sx_res];
};


export const restruct_coin = (a_coin: Nilable<SlimCoin>) => a_coin? {
	amount: a_coin[0],
	denom: a_coin[1],
}: __UNDEFINED;

export const restruct_temporal = (xt_temporal: Nilable<number>) => xt_temporal
	? {
		seconds: Math.floor(xt_temporal / 1e3)+'',
		nanos: (xt_temporal % 1e3) * 1e6,
	}
	: __UNDEFINED;
