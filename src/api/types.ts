import type {JsonObject} from '@blake.regalia/belt';
import type { CwBase64 } from '@solar-republic/types';

declare const INTERFACES: unique symbol;

export type ImplementsInterfaces<
	as_interfaces extends string,
> = Uint8Array & {
	[INTERFACES]: {
		[si_interface in as_interfaces]: 1;
	};
};

export type Encoded<
	p_type extends string,
> = ImplementsInterfaces<p_type>;

export type PropagateUndefined<z_any> = z_any extends undefined? undefined: never;

export type Any<
	g_msg extends JsonObject,
	p_type extends string,
> = {
	'@type': p_type;
} & g_msg;

export type JsonAny<
	p_type extends string=string,
> = {
	type_url: p_type;
	value: CwBase64;
};
