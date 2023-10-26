/* eslint-disable prefer-const */
import type {Dict, JsonObject, JsonValue} from '@blake.regalia/belt';

import {safe_json, ode, buffer_to_base64} from '@blake.regalia/belt';


export type RpcRequest<
	a_args extends any[]=[],
> = (...a_args: a_args) => [string] | [string, JsonObject<Uint8Array | undefined>];

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

const json_to_flatdot = (w_value: JsonValue<Uint8Array>, h_root: Dict, sr_path: string): void => {
	if(Array.isArray(w_value)) {
		// eslint-disable-next-line array-callback-return
		w_value.map((w_item, i_item) => {
			json_to_flatdot(w_item, h_root, `${sr_path}[${i_item}]`);
		});
	}
	else if(ArrayBuffer.isView(w_value)) {
		h_root[sr_path] = buffer_to_base64(w_value);
	}
	else if('object' === typeof w_value) {
		json_object_to_flatdot(w_value as JsonObject, h_root, sr_path);
	}
	else {
		h_root[sr_path] = encodeURIComponent(w_value+'');
	}
};

const json_object_to_flatdot = (h_object: JsonObject<Uint8Array | undefined>, h_root: Dict={}, sr_path=''): Dict => {
	for(const [si_key, w_value] of ode(h_object)) {
		// anything falsy is default, skip it
		if(!w_value) continue;

		// encode
		json_to_flatdot(w_value as JsonObject<Uint8Array>, h_root, (sr_path? sr_path+'.': '')+si_key);
	}

	return h_root;
};

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

	// indicated submit action
	if(1 === g_init) {
		// convert to POST request
		g_init = {method:'POST'};

		// args were supplied; convert to JSON-encoded body
		if(h_args) {
			g_init = {
				body: JSON.stringify(h_args),
			};
		}
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
