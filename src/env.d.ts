import type {MethodOptions} from 'google-protobuf/google/protobuf/descriptor_pb';

interface MethodOptionsWithHttpExtension {
	http?: {
		body: string;
		get: string;
		post: string;
		selector: string;
	};
}

interface MethodOptionsWithHttp extends MethodOptions.AsObject, MethodOptionsWithHttpExtension {}

interface MethodOptionsWithCosmosExtension {
	implementsInterfaceList?: string[];
}

interface MessageOptionsWithCosmos extends MessageOptions.AsObject, MethodOptionsWithCosmosExtension {}

// interface Method

declare module 'google-protobuf/google/protobuf/descriptor_pb' {
	namespace MethodOptions {
		interface AsObject extends MethodOptionsWithHttpExtension, MethodOptionsWithCosmosExtension {}
	}

	// namespace MethodDescriptorProto {
	// 	interface AsObject extends 
	// }
}
