import type {JsonObject} from '@blake.regalia/belt';


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

export type JsonAny<
	p_type extends string=string,
	g_msg extends JsonObject=JsonObject,
> = {
	'@type': p_type;
} & g_msg;

// export type JsonAny<
// 	p_type extends string=string,
// > = {
// 	type_url: p_type;
// 	value: CwBase64;
// };

// export type Opt<
// 	z_type,
// > = Nilable<z_type> | (z_type extends string
// 	? ''
// 	: z_type extends Array<infer z_item>
// 		? Nilable<z_item[]>
// 		: never);

export type Opt<
	z_type,
>= z_type | null | undefined | (z_type extends string? '': never);

export type WeakTimestampStr = `${string}T${string}Z`;

export type WeakDurationStr = `${bigint}.${bigint}s`;
