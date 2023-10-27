import type {
	MethodOptions,
	FieldDescriptorProto,
	FileDescriptorProto,
	ServiceDescriptorProto,
	MethodDescriptorProto,
	MessageOptions,
	DescriptorProto,
	EnumDescriptorProto,
	FieldOptions,
	EnumValueDescriptorProto,
	EnumValueOptions,
} from 'google-protobuf/google/protobuf/descriptor_pb';

// ################################
// #  Local utility types 
// ################################

interface AugmentComments {
	comments: string;
}

interface AugmentSource extends AugmentComments {
	source: AugmentedFile;
}


// ################################
// # Element augmentations
// ################################

export interface FileAugmentations {
	parts: {
		vendor: string;
		module: string;
		version: string;
		purpose: string;
	};

	serviceList: AugmentedService[];
	messageTypeList: AugmentedMessage[];
	enumTypeList: AugmentedEnum[];
}

export interface ServiceAugmentations extends AugmentSource {
	methodList: AugmentedMethod[];
}

export interface MethodAugmentations extends AugmentComments {
	service: AugmentedService;

	options?: ExtendedMethodOptions;
}

export interface MessageAugmentations extends AugmentSource {
	form: 'message';
	path: string;
	options?: ExtendedMessageOptions;
	fieldList: AugmentedField[];
	nestedTypeList: AugmentedMessage[];
	enumTypeList: AugmentedEnum[];
	// nestedTypeHash: Dict<AugmentedField>;
	// nestedEnumHash: Dict<AugmentedEnum>;
}

export interface FieldAugmentations extends AugmentComments {
	repeated: boolean;
	options?: ExtendedFieldOptions;
}

export interface EnumAugmentations extends AugmentSource {
	form: 'enum';
	path: string;
	valueList: AugmentedEnumValue[];
}

export interface EnumValueAugmentations extends AugmentComments {
	enum: EnumAugmentations;
	options?: ExtendedEnumValueOptions;
}


// ################################
// #  Option extensions
// ################################

export interface ExtendedMethodOptions extends MethodOptions.AsObject {
	// `google.api.http`
	http?: {
		body: string;
		get: string;
		post: string;
		selector: string;
	};
}

interface ExtendedMessageOptions extends MessageOptions.AsObject {
	// `cosmos_proto.implements_interface`
	implementsInterfaceList?: string[];
}

interface ExtendedFieldOptions extends FieldOptions.AsObject {
	// `cosmos_proto.accepts_interface`
	acceptsInterface?: string;

	// `gogoproto.nullable`
	nullable?: boolean;
}

interface ExtendedEnumValueOptions extends EnumValueOptions.AsObject {
	enumvalueCustomname?: string;
}


// ################################
// #  Exports
// ################################

export interface AugmentedFile extends
	Omit<FileDescriptorProto.AsObject, keyof FileAugmentations>,
	FileAugmentations {}

export interface AugmentedService extends
	Omit<ServiceDescriptorProto.AsObject, keyof ServiceAugmentations>,
	ServiceAugmentations {}

export interface AugmentedMethod extends
	Omit<MethodDescriptorProto.AsObject, keyof MethodAugmentations>,
	MethodAugmentations {}

export interface AugmentedMessage extends
	Omit<DescriptorProto.AsObject, keyof MessageAugmentations>,
	MessageAugmentations {}

export interface AugmentedField extends
	Omit<FieldDescriptorProto.AsObject, keyof FieldAugmentations>,
	FieldAugmentations {}

export interface AugmentedEnum extends
	Omit<EnumDescriptorProto.AsObject, keyof EnumAugmentations>,
	EnumAugmentations {}

export interface AugmentedEnumValue extends
	Omit<EnumValueDescriptorProto.AsObject, keyof EnumValueAugmentations>,
	EnumValueAugmentations {}


export type ProtoElement =
	| FileDescriptorProto.AsObject
	| ServiceDescriptorProto.AsObject
	| MethodDescriptorProto.AsObject
	| DescriptorProto.AsObject
	| FieldDescriptorProto.AsObject
	| EnumDescriptorProto.AsObject
	| EnumValueDescriptorProto.AsObject;

export type AugmentedElement =
	| AugmentedFile
	| AugmentedService
	| AugmentedMethod
	| AugmentedMessage
	| AugmentedField
	| AugmentedEnum
	| AugmentedEnumValue;

export type AugmentedFormOf<
	g_form extends ProtoElement,
	g_strict extends Required<g_form>=Required<g_form>,
> = g_strict extends Required<FileDescriptorProto.AsObject>
	? AugmentedFile
	: g_strict extends Required<ServiceDescriptorProto.AsObject>
		? AugmentedService
		: g_strict extends Required<MethodDescriptorProto.AsObject>
			? AugmentedMethod
			: g_strict extends Required<DescriptorProto.AsObject>
				? AugmentedMessage
				: g_strict extends Required<FieldDescriptorProto.AsObject>
					? AugmentedField
					: g_strict extends Required<EnumDescriptorProto.AsObject>
						? AugmentedEnum
						: g_strict extends Required<EnumValueDescriptorProto.AsObject>
							? AugmentedEnumValue
							: AugmentedElement;

declare module 'google-protobuf/google/protobuf/descriptor_pb' {
	// namespace MethodOptions {
	// 	interface AsObject extends MethodOptionsWithHttpExtension, MethodOptionsWithCosmosExtension {}
	// }

	// namespace FieldDescriptorProto {
	// 	interface AsObject extends FieldDescriptorProtoAugmentations {}
	// }

	// namespace MethodDescriptorProto {
	// 	interface AsObject extends 
	// }
}
