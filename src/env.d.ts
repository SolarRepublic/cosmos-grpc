import type {
	MethodOptions,
	FieldDescriptorProto,
	FileDescriptorProto,
} from 'google-protobuf/google/protobuf/descriptor_pb';

interface MethodOptionsWithHttpExtension {
	http?: {
		body: string;
		get: string;
		post: string;
		selector: string;
	};
}

interface MethodOptionsWithCosmosExtension {
	implementsInterfaceList?: string[];
}

interface FieldDescriptorProtoAugmentations {
	repeated: boolean;
	comments: string;
}

interface FileDescriptorProtoAugmentations {
	parts: {
		vendor: string;
		module: string;
		version: string;
		purpose: string;
	};
}


interface MethodOptionsWithHttp extends MethodOptions.AsObject, MethodOptionsWithHttpExtension {}

interface MessageOptionsWithCosmos extends MessageOptions.AsObject, MethodOptionsWithCosmosExtension {}

export interface AugmentedField extends FieldDescriptorProto.AsObject, FieldDescriptorProtoAugmentations {}

export interface AugmentedFile extends FileDescriptorProto.AsObject, FileDescriptorProtoAugmentations {}

// interface Method

declare module 'google-protobuf/google/protobuf/descriptor_pb' {
	namespace MethodOptions {
		interface AsObject extends MethodOptionsWithHttpExtension, MethodOptionsWithCosmosExtension {}
	}

	namespace FieldDescriptorProto {
		interface AsObject extends FieldDescriptorProtoAugmentations {}
	}

	// namespace MethodDescriptorProto {
	// 	interface AsObject extends 
	// }
}
