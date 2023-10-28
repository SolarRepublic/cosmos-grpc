import type { Nilable } from '@blake.regalia/belt';
import { __UNDEFINED } from '@blake.regalia/belt';

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
