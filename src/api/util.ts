import type {
	Nilable,
} from '@blake.regalia/belt';

import {
	__UNDEFINED,
	buffer_to_base64,
	buffer_to_text,
	base64_to_buffer,
	base64_to_text,
	oda,
} from '@blake.regalia/belt';

export const safe_buffer_to_base64 = (atu8_buffer: Nilable<Uint8Array>): string | undefined => atu8_buffer? buffer_to_base64(atu8_buffer): __UNDEFINED;

export const safe_buffer_to_text = (atu8_buffer: Nilable<Uint8Array>): string | undefined => atu8_buffer? buffer_to_text(atu8_buffer): __UNDEFINED;

export const safe_base64_to_buffer = (sb64_data: Nilable<string>): Uint8Array | undefined => sb64_data? base64_to_buffer(sb64_data): __UNDEFINED;

export const safe_base64_to_text = (sb64_data: Nilable<string>): string | undefined => sb64_data? base64_to_text(sb64_data): __UNDEFINED;

export const die = (s_msg: string, w_data?: unknown): never => {
	throw oda(Error(s_msg), {data:w_data});
};
