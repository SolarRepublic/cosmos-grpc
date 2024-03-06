/* eslint-disable prefer-const */
import type {Nilable, JsonObject, JsonValue} from '@blake.regalia/belt';

import type {SlimCoin} from '@solar-republic/types';

import {bytes_to_base64, __UNDEFINED, is_array, parse_json_safe, entries} from '@blake.regalia/belt';

type Voidable = void | undefined;

export type RpcRequest<
	a_args extends any[]=[],
> = (...a_args: a_args) => [string] | [string, JsonObject<Voidable | Uint8Array>];

export const F_RPC_REQ_NO_ARGS: RpcRequest = () => [''];

export type NetworkJsonResponse<
	w_type extends JsonValue<Voidable>=JsonValue | undefined,
> = [
	d_res: Response,
	sx_res: string,
	g_res: w_type,
];

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
	else if('object' === typeof w_value) {
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
	z_req: string | {origin: string} & RequestInit,
	...a_args: a_args
): Promise<NetworkJsonResponse<w_parsed>> => {
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

	// normalize origin and request init
	let p_origin = z_req as string;
	if('string' !== typeof z_req) {
		p_origin = z_req.origin;
		g_init = {...z_req, ...g_init};
	}

	// submit request
	const d_res = await fetch(p_origin+sr_append, g_init);

	// resolve as text
	const sx_res = await d_res.text();

	// parse json
	const g_res = parse_json_safe<w_parsed>(sx_res);

	// response tuple
	const a_tuple: NetworkJsonResponse<w_parsed> = [d_res, sx_res, g_res!];

	// not json or response/network error
	// eslint-disable-next-line no-throw-literal
	if(!g_res || !d_res.ok) throw a_tuple;

	// return truple
	return a_tuple;
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
