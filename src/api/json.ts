import type {WeakDurationStr, WeakTimestampStr} from './types';
import type {Nilable} from '@blake.regalia/belt';


import type {WeakUintStr} from '@solar-republic/types';

import {__UNDEFINED} from '@blake.regalia/belt';

export const parse_duration = (s_duration: Nilable<string>): number | undefined => s_duration
	? +/^([\d.]+)s$/.exec(s_duration)![0] * 1e3
	: __UNDEFINED;

export const parse_timestamp = (s_timestamp: Nilable<string>): number | undefined => s_timestamp
	? Date.parse(s_timestamp)
	: __UNDEFINED;

export const duration_to_json = (xn_milliseconds: Nilable<number>): string | undefined => xn_milliseconds
	? (xn_milliseconds / 1e3)+''
	: __UNDEFINED;

export const timestamp_to_json = (xt_timestamp: Nilable<number>): string | undefined => xt_timestamp
	? new Date(xt_timestamp).toISOString()
	: __UNDEFINED;

export const expand_duration = <
	d_undefined=undefined,
>(a_temporal: [string, number] | Extract<d_undefined, undefined>): WeakDurationStr | Extract<d_undefined, undefined> => (a_temporal? a_temporal[0]+'.'+(''+(a_temporal[1] | 0)).padStart(9, '0'): __UNDEFINED) as WeakDurationStr | Extract<d_undefined, undefined>;


/**
 * Converts a slim google.protobuf.Timestamp into an ISO datetime string
 * @param a_temporal 
 * @returns 
 */
export const expand_timestamp = <
	d_undefined=undefined,
>(a_temporal: [string, number] | Extract<d_undefined, undefined>): WeakTimestampStr | Extract<d_undefined, undefined> => {
	// @ts-expect-error implicit void
	if(!a_temporal) return;

	// destructure tuple
	const [sg_seconds, xn_nanos] = a_temporal;

	// convert nanoseconds to milliseconds
	const xn_millis = xn_nanos / 1e6;

	// create basis ISO date string
	const s_basis = new Date((+sg_seconds * 1e3) + (xn_millis | 0)).toISOString();

	// truncate milliseconds
	const xn_remainder = xn_millis % 1;

	// non-empty; append fractional seconds to string
	if(xn_remainder) {
		return s_basis.replace(/Z$/, xn_remainder.toFixed(6)+'Z') as WeakTimestampStr;
	}

	// return basis string
	return s_basis as WeakTimestampStr;
};

type Coin = {
	denom: string;
	amount: WeakUintStr;
};

export const expand_coin = <
	d_undefined=undefined,
>(a_coin: [denom: string, amount: string] | Extract<d_undefined, undefined>): Coin | Extract<d_undefined, undefined> => (a_coin? {
	denom: a_coin[0],
	amount: a_coin[1],
}: __UNDEFINED) as Coin;
