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
