import type {
	Nilable,
} from '@blake.regalia/belt';

import type {CwBase64, WeakBech32Addr} from '@solar-republic/types';

import {
	__UNDEFINED,
	bytes_to_base64,
	bytes_to_text,
	base64_to_bytes,
	base64_to_text,
	oda,
} from '@blake.regalia/belt';

export const safe_bytes_to_base64 = (atu8_buffer: Nilable<Uint8Array>): CwBase64 | undefined => atu8_buffer? bytes_to_base64(atu8_buffer) as unknown as CwBase64: __UNDEFINED;

export const safe_bytes_to_text = (atu8_buffer: Nilable<Uint8Array>): string | undefined => atu8_buffer? bytes_to_text(atu8_buffer): __UNDEFINED;

export const safe_base64_to_bytes = (sb64_data: Nilable<string>): Uint8Array | undefined => sb64_data? base64_to_bytes(sb64_data): __UNDEFINED;

export const safe_base64_to_text = (sb64_data: Nilable<string>): string | undefined => sb64_data? base64_to_text(sb64_data): __UNDEFINED;

export const addr_bytes_to_bech32 = (sb64_data: CwBase64 | undefined): WeakBech32Addr | undefined => sb64_data? '1'+safe_base64_to_text(sb64_data) as WeakBech32Addr: __UNDEFINED;

export const die = (s_msg: string, w_data?: unknown): never => {
	throw oda(Error(s_msg), {data:w_data});
};
