import {__UNDEFINED, buffer_to_base64, buffer_to_text} from '@blake.regalia/belt';

export const safe_buffer_to_base64 = (atu8_buffer: Uint8Array | undefined): string | undefined => atu8_buffer? buffer_to_base64(atu8_buffer): __UNDEFINED;

export const safe_buffer_to_text = (atu8_buffer: Uint8Array | undefined): string | undefined => atu8_buffer? buffer_to_text(atu8_buffer): __UNDEFINED;
