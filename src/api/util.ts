import type {
	NaiveBase64,
	Nilable,
} from '@blake.regalia/belt';

import type {CwBase64, WeakBech32Addr} from '@solar-republic/types';

import {
	__UNDEFINED,
	bytes_to_base64,
	bytes_to_text,
	base64_to_bytes,
	base64_to_text,
	try_sync,
} from '@blake.regalia/belt';


export const safe_bytes_to_base64 = (atu8_buffer: Nilable<Uint8Array>): CwBase64 | undefined => atu8_buffer? try_sync(() => bytes_to_base64(atu8_buffer) as unknown as CwBase64)[0] || __UNDEFINED: __UNDEFINED;

export const safe_bytes_to_text = (atu8_buffer: Nilable<Uint8Array>): string | undefined => atu8_buffer? try_sync(() => bytes_to_text(atu8_buffer))[0] || __UNDEFINED: __UNDEFINED;

export const safe_base64_to_bytes = (sb64_data: Nilable<string>): Uint8Array | undefined => sb64_data? try_sync(() => base64_to_bytes(sb64_data))[0] || __UNDEFINED: __UNDEFINED;

export const safe_base64_to_text = (sb64_data: Nilable<string>): string | undefined => sb64_data? try_sync(() => base64_to_text(sb64_data))[0] || __UNDEFINED: __UNDEFINED;

export const addr_bytes_to_bech32 = (sb64_data: NaiveBase64 | undefined): WeakBech32Addr | undefined => sb64_data? '1'+safe_base64_to_text(sb64_data) as WeakBech32Addr: __UNDEFINED;
