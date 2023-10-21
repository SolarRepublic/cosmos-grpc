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
} from 'google-protobuf/google/protobuf/descriptor_pb';

// ################################
// #  Local utility types 
// ################################

interface AugmentComments {
	comments: string;
}

interface AugmentSource extends AugmentComments {
	source: AugmentedFile;
	index: number;
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
	options?: ExtendedMessageOptions;
	fieldList: AugmentedField[];
	nestedTypeList: AugmentedField[];
}

export interface EnumAugmentations extends AugmentSource {}


export interface FieldAugmentations extends AugmentComments {
	repeated: boolean;
	options?: ExtendedFieldOptions;
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
