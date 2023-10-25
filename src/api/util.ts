import {
	__UNDEFINED,
	buffer_to_base64,
	buffer_to_text,
	base64_to_buffer,
	base64_to_text,
} from '@blake.regalia/belt';

export const safe_buffer_to_base64 = (atu8_buffer: Uint8Array | undefined): string | undefined => atu8_buffer? buffer_to_base64(atu8_buffer): __UNDEFINED;

export const safe_buffer_to_text = (atu8_buffer: Uint8Array | undefined): string | undefined => atu8_buffer? buffer_to_text(atu8_buffer): __UNDEFINED;

export const safe_base64_to_buffer = (sb64_data: string | undefined): Uint8Array | undefined => sb64_data? base64_to_buffer(sb64_data): __UNDEFINED;

export const safe_base64_to_text = (sb64_data: string | undefined): string | undefined => sb64_data? base64_to_text(sb64_data): __UNDEFINED;

