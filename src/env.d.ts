import type {
	MethodOptions,
	FieldDescriptorProto,
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

interface FieldDescriptorProtoWithCommentsExtension {
	comments: string;
}


interface MethodOptionsWithHttp extends MethodOptions.AsObject, MethodOptionsWithHttpExtension {}

interface MessageOptionsWithCosmos extends MessageOptions.AsObject, MethodOptionsWithCosmosExtension {}

interface FieldDescriptorProtoWithComments extends FieldDescriptorProto.AsObject, FieldDescriptorProtoWithCommentsExtension {}

// interface Method

declare module 'google-protobuf/google/protobuf/descriptor_pb' {
	namespace MethodOptions {
		interface AsObject extends MethodOptionsWithHttpExtension, MethodOptionsWithCosmosExtension {}
	}

	namespace FieldDescriptorProto {
		interface AsObject extends FieldDescriptorProtoWithCommentsExtension {}
	}

	// namespace MethodDescriptorProto {
	// 	interface AsObject extends 
	// }
}
