import { createRequire as __openmausbotCreateRequire } from "node:module"; const require = __openmausbotCreateRequire(import.meta.url);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/.pnpm/@ubjs+node@0.31.0-3/node_modules/@ubjs/node/typescript/dist/resolve-lib.js
var require_resolve_lib = __commonJS({
  "node_modules/.pnpm/@ubjs+node@0.31.0-3/node_modules/@ubjs/node/typescript/dist/resolve-lib.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ResolveLibPathError = void 0;
    exports.detectTripleForTesting = detectTripleForTesting;
    exports.resolveLibPath = resolveLibPath4;
    exports.setDetectTripleForTesting = setDetectTripleForTesting;
    var node_fs_1 = __require("node:fs");
    var node_module_1 = __require("node:module");
    var node_path_1 = __require("node:path");
    var node_url_1 = __require("node:url");
    function detectNodeTriple(proc) {
      const { platform, arch } = proc;
      if (platform === "darwin" && arch === "arm64")
        return "darwin-arm64";
      if (platform === "darwin" && arch === "x64")
        return "darwin-x64";
      if (platform === "linux" && (arch === "x64" || arch === "arm64")) {
        const isGnu = proc.report?.getReport()?.header?.glibcVersionRuntime !== void 0;
        return `linux-${arch}-${isGnu ? "gnu" : "musl"}`;
      }
      if (platform === "win32" && (arch === "x64" || arch === "arm64")) {
        return `win32-${arch}-msvc`;
      }
      throw new Error(`Unsupported platform/arch combination: ${platform}/${arch}. Supported: darwin-{arm64,x64}, linux-{x64,arm64}-{gnu,musl}, win32-{x64,arm64}-msvc.`);
    }
    function detectCargoTriple(proc) {
      const { platform, arch } = proc;
      const archMap = {
        arm64: "aarch64",
        x64: "x86_64"
      };
      const llvmArch = archMap[arch];
      if (llvmArch === void 0) {
        throw new Error(`Unsupported platform/arch combination: ${platform}/${arch}. Supported arches: arm64, x64.`);
      }
      if (platform === "darwin")
        return `${llvmArch}-apple-darwin`;
      if (platform === "linux") {
        const isGnu = proc.report?.getReport()?.header?.glibcVersionRuntime !== void 0;
        return `${llvmArch}-unknown-linux-${isGnu ? "gnu" : "musl"}`;
      }
      if (platform === "win32")
        return `${llvmArch}-pc-windows-msvc`;
      throw new Error(`Unsupported platform/arch combination: ${platform}/${arch}. Supported: darwin, linux, win32.`);
    }
    function detectTriple(proc, style) {
      return style === "node" ? detectNodeTriple(proc) : detectCargoTriple(proc);
    }
    function detectTripleForTesting(proc, style = "cargo") {
      return detectTriple(proc, style);
    }
    var ResolveLibPathError = class extends Error {
      mode;
      crateName;
      attempted;
      cause;
      constructor(args) {
        super(args.message);
        this.name = "ResolveLibPathError";
        this.mode = args.mode;
        this.crateName = args.crateName;
        this.attempted = args.attempted;
        if (args.cause !== void 0)
          this.cause = args.cause;
      }
    };
    exports.ResolveLibPathError = ResolveLibPathError;
    function callerDir(callerUrl) {
      const path = callerUrl.startsWith("file://") ? (0, node_url_1.fileURLToPath)(callerUrl) : callerUrl;
      return (0, node_path_1.dirname)(path);
    }
    function libFileName(crateName, platform) {
      if (platform === "win32")
        return `${crateName}.dll`;
      const ext = platform === "darwin" ? "dylib" : "so";
      return `lib${crateName}.${ext}`;
    }
    function resolveLibPath4(opts) {
      if (process.env.OPENMAUSBOT_CUA_SDK_LIBRARY) return resolveOverride(opts.crateName, process.env.OPENMAUSBOT_CUA_SDK_LIBRARY);
      if ("override" in opts && opts.override !== void 0) {
        return resolveOverride(opts.crateName, opts.override);
      }
      if ("npmPackageBase" in opts && opts.npmPackageBase !== void 0) {
        return resolveNpmPackage(opts.crateName, opts.callerUrl, opts.npmPackageBase, opts.tripleStyle ?? "cargo");
      }
      return resolveColocated(opts.crateName, opts.callerUrl);
    }
    function resolveColocated(crateName, callerUrl) {
      const candidate = (0, node_path_1.join)(callerDir(callerUrl), libFileName(crateName, process.platform));
      if (!(0, node_fs_1.existsSync)(candidate)) {
        throw new ResolveLibPathError({
          message: `Could not find lib for crate "${crateName}" colocated with caller. Looked for: ${candidate}.`,
          mode: "colocated",
          crateName,
          attempted: [candidate]
        });
      }
      return candidate;
    }
    function resolveOverride(crateName, path) {
      if (!(0, node_path_1.isAbsolute)(path)) {
        throw new ResolveLibPathError({
          message: `Override path must be absolute; got "${path}".`,
          mode: "override",
          crateName,
          attempted: [path]
        });
      }
      if (!(0, node_fs_1.existsSync)(path)) {
        throw new ResolveLibPathError({
          message: `Override path "${path}" for crate "${crateName}" does not exist.`,
          mode: "override",
          crateName,
          attempted: [path]
        });
      }
      return path;
    }
    var _detectTripleImpl = (style) => detectTriple(process, style);
    function setDetectTripleForTesting(fn) {
      const prev = _detectTripleImpl;
      _detectTripleImpl = fn;
      return prev;
    }
    function resolveNpmPackage(crateName, callerUrl, npmPackageBase, tripleStyle) {
      const triple = _detectTripleImpl(tripleStyle);
      const pkgName = `${npmPackageBase}${triple}`;
      const require_ = (0, node_module_1.createRequire)(callerUrl);
      let pkgJsonPath;
      try {
        pkgJsonPath = require_.resolve(`${pkgName}/package.json`);
      } catch (cause) {
        throw new ResolveLibPathError({
          message: `Could not find platform package for crate "${crateName}": tried "${pkgName}". Detected platform: ${triple}. Either the package is not installed (run npm install) or this platform is not in the published matrix.`,
          mode: "npmPackageBase",
          crateName,
          attempted: [pkgName],
          cause
        });
      }
      const binaryPath = (0, node_path_1.join)((0, node_path_1.dirname)(pkgJsonPath), libFileName(crateName, process.platform));
      if (!(0, node_fs_1.existsSync)(binaryPath)) {
        throw new ResolveLibPathError({
          message: `Platform package "${pkgName}" is installed but does not contain "${libFileName(crateName, process.platform)}" \u2014 package layout is malformed.`,
          mode: "npmPackageBase",
          crateName,
          attempted: [binaryPath]
        });
      }
      return binaryPath;
    }
  }
});

// node_modules/.pnpm/@trycua+cua-driver@0.28.2/node_modules/@trycua/cua-driver/dist/native/node-runtime.js
var import_resolve_lib = __toESM(require_resolve_lib(), 1);
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
var FfiType = {
  UInt8: { tag: "UInt8" },
  Int8: { tag: "Int8" },
  UInt16: { tag: "UInt16" },
  Int16: { tag: "Int16" },
  UInt32: { tag: "UInt32" },
  Int32: { tag: "Int32" },
  UInt64: { tag: "UInt64" },
  Int64: { tag: "Int64" },
  Float32: { tag: "Float32" },
  Float64: { tag: "Float64" },
  Handle: { tag: "Handle" },
  RustBuffer: { tag: "RustBuffer" },
  ForeignBytes: { tag: "ForeignBytes" },
  RustCallStatus: { tag: "RustCallStatus" },
  VoidPointer: { tag: "VoidPointer" },
  Void: { tag: "Void" },
  Callback: (name) => ({ tag: "Callback", name }),
  Struct: (name) => ({ tag: "Struct", name }),
  Reference: (inner) => ({ tag: "Reference", inner }),
  MutReference: (inner) => ({ tag: "MutReference", inner })
};
var sdkLibrary = (0, import_resolve_lib.resolveLibPath)({
  crateName: "cua_driver_sdk",
  callerUrl: import.meta.url,
  npmPackageBase: "@trycua/cua-driver-",
  tripleStyle: "node"
});
var runtimePath = join(dirname(sdkLibrary), "cua_driver_node_runtime.node");
var require2 = createRequire(import.meta.url);
var { UniffiNativeModule } = require2(runtimePath);
var node_runtime_default = { FfiType, resolveLibPath: import_resolve_lib.resolveLibPath, UniffiNativeModule };

// node_modules/.pnpm/@trycua+cua-driver@0.28.2/node_modules/@trycua/cua-driver/dist/native/cua_driver_sdk-ffi.js
var { UniffiNativeModule: UniffiNativeModule2, FfiType: FfiType2, resolveLibPath: resolveLibPath2 } = node_runtime_default;
var DEFINITIONS = {
  symbols: {
    rustbuffer_alloc: "ffi_cua_driver_sdk_rustbuffer_alloc",
    rustbuffer_free: "ffi_cua_driver_sdk_rustbuffer_free",
    rustbuffer_from_bytes: "ffi_cua_driver_sdk_rustbuffer_from_bytes"
  },
  functions: {
    "ffi_cua_driver_sdk_rust_future_poll_u8": {
      args: [FfiType2.Handle, FfiType2.Callback("RustFutureContinuationCallback"), FfiType2.Handle],
      ret: FfiType2.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_sdk_rust_future_cancel_u8": {
      args: [FfiType2.Handle],
      ret: FfiType2.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_sdk_rust_future_complete_u8": {
      args: [FfiType2.Handle],
      ret: FfiType2.UInt8,
      hasRustCallStatus: true
    },
    "ffi_cua_driver_sdk_rust_future_free_u8": {
      args: [FfiType2.Handle],
      ret: FfiType2.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_sdk_rust_future_poll_i8": {
      args: [FfiType2.Handle, FfiType2.Callback("RustFutureContinuationCallback"), FfiType2.Handle],
      ret: FfiType2.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_sdk_rust_future_cancel_i8": {
      args: [FfiType2.Handle],
      ret: FfiType2.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_sdk_rust_future_complete_i8": {
      args: [FfiType2.Handle],
      ret: FfiType2.Int8,
      hasRustCallStatus: true
    },
    "ffi_cua_driver_sdk_rust_future_free_i8": {
      args: [FfiType2.Handle],
      ret: FfiType2.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_sdk_rust_future_poll_u16": {
      args: [FfiType2.Handle, FfiType2.Callback("RustFutureContinuationCallback"), FfiType2.Handle],
      ret: FfiType2.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_sdk_rust_future_cancel_u16": {
      args: [FfiType2.Handle],
      ret: FfiType2.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_sdk_rust_future_complete_u16": {
      args: [FfiType2.Handle],
      ret: FfiType2.UInt16,
      hasRustCallStatus: true
    },
    "ffi_cua_driver_sdk_rust_future_free_u16": {
      args: [FfiType2.Handle],
      ret: FfiType2.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_sdk_rust_future_poll_i16": {
      args: [FfiType2.Handle, FfiType2.Callback("RustFutureContinuationCallback"), FfiType2.Handle],
      ret: FfiType2.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_sdk_rust_future_cancel_i16": {
      args: [FfiType2.Handle],
      ret: FfiType2.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_sdk_rust_future_complete_i16": {
      args: [FfiType2.Handle],
      ret: FfiType2.Int16,
      hasRustCallStatus: true
    },
    "ffi_cua_driver_sdk_rust_future_free_i16": {
      args: [FfiType2.Handle],
      ret: FfiType2.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_sdk_rust_future_poll_u32": {
      args: [FfiType2.Handle, FfiType2.Callback("RustFutureContinuationCallback"), FfiType2.Handle],
      ret: FfiType2.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_sdk_rust_future_cancel_u32": {
      args: [FfiType2.Handle],
      ret: FfiType2.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_sdk_rust_future_complete_u32": {
      args: [FfiType2.Handle],
      ret: FfiType2.UInt32,
      hasRustCallStatus: true
    },
    "ffi_cua_driver_sdk_rust_future_free_u32": {
      args: [FfiType2.Handle],
      ret: FfiType2.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_sdk_rust_future_poll_i32": {
      args: [FfiType2.Handle, FfiType2.Callback("RustFutureContinuationCallback"), FfiType2.Handle],
      ret: FfiType2.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_sdk_rust_future_cancel_i32": {
      args: [FfiType2.Handle],
      ret: FfiType2.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_sdk_rust_future_complete_i32": {
      args: [FfiType2.Handle],
      ret: FfiType2.Int32,
      hasRustCallStatus: true
    },
    "ffi_cua_driver_sdk_rust_future_free_i32": {
      args: [FfiType2.Handle],
      ret: FfiType2.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_sdk_rust_future_poll_u64": {
      args: [FfiType2.Handle, FfiType2.Callback("RustFutureContinuationCallback"), FfiType2.Handle],
      ret: FfiType2.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_sdk_rust_future_cancel_u64": {
      args: [FfiType2.Handle],
      ret: FfiType2.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_sdk_rust_future_complete_u64": {
      args: [FfiType2.Handle],
      ret: FfiType2.Handle,
      hasRustCallStatus: true
    },
    "ffi_cua_driver_sdk_rust_future_free_u64": {
      args: [FfiType2.Handle],
      ret: FfiType2.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_sdk_rust_future_poll_i64": {
      args: [FfiType2.Handle, FfiType2.Callback("RustFutureContinuationCallback"), FfiType2.Handle],
      ret: FfiType2.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_sdk_rust_future_cancel_i64": {
      args: [FfiType2.Handle],
      ret: FfiType2.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_sdk_rust_future_complete_i64": {
      args: [FfiType2.Handle],
      ret: FfiType2.Int64,
      hasRustCallStatus: true
    },
    "ffi_cua_driver_sdk_rust_future_free_i64": {
      args: [FfiType2.Handle],
      ret: FfiType2.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_sdk_rust_future_poll_f32": {
      args: [FfiType2.Handle, FfiType2.Callback("RustFutureContinuationCallback"), FfiType2.Handle],
      ret: FfiType2.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_sdk_rust_future_cancel_f32": {
      args: [FfiType2.Handle],
      ret: FfiType2.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_sdk_rust_future_complete_f32": {
      args: [FfiType2.Handle],
      ret: FfiType2.Float32,
      hasRustCallStatus: true
    },
    "ffi_cua_driver_sdk_rust_future_free_f32": {
      args: [FfiType2.Handle],
      ret: FfiType2.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_sdk_rust_future_poll_f64": {
      args: [FfiType2.Handle, FfiType2.Callback("RustFutureContinuationCallback"), FfiType2.Handle],
      ret: FfiType2.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_sdk_rust_future_cancel_f64": {
      args: [FfiType2.Handle],
      ret: FfiType2.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_sdk_rust_future_complete_f64": {
      args: [FfiType2.Handle],
      ret: FfiType2.Float64,
      hasRustCallStatus: true
    },
    "ffi_cua_driver_sdk_rust_future_free_f64": {
      args: [FfiType2.Handle],
      ret: FfiType2.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_sdk_rust_future_poll_rust_buffer": {
      args: [FfiType2.Handle, FfiType2.Callback("RustFutureContinuationCallback"), FfiType2.Handle],
      ret: FfiType2.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_sdk_rust_future_cancel_rust_buffer": {
      args: [FfiType2.Handle],
      ret: FfiType2.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_sdk_rust_future_complete_rust_buffer": {
      args: [FfiType2.Handle],
      ret: FfiType2.RustBuffer,
      hasRustCallStatus: true
    },
    "ffi_cua_driver_sdk_rust_future_free_rust_buffer": {
      args: [FfiType2.Handle],
      ret: FfiType2.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_sdk_rust_future_poll_void": {
      args: [FfiType2.Handle, FfiType2.Callback("RustFutureContinuationCallback"), FfiType2.Handle],
      ret: FfiType2.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_sdk_rust_future_cancel_void": {
      args: [FfiType2.Handle],
      ret: FfiType2.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_sdk_rust_future_complete_void": {
      args: [FfiType2.Handle],
      ret: FfiType2.Void,
      hasRustCallStatus: true
    },
    "ffi_cua_driver_sdk_rust_future_free_void": {
      args: [FfiType2.Handle],
      ret: FfiType2.Void,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_clone_cuadriver": {
      args: [FfiType2.Handle],
      ret: FfiType2.Handle,
      hasRustCallStatus: true
    },
    "uniffi_cua_driver_sdk_fn_free_cuadriver": {
      args: [FfiType2.Handle],
      ret: FfiType2.Void,
      hasRustCallStatus: true
    },
    "uniffi_cua_driver_sdk_fn_clone_cuadriversession": {
      args: [FfiType2.Handle],
      ret: FfiType2.Handle,
      hasRustCallStatus: true
    },
    "uniffi_cua_driver_sdk_fn_free_cuadriversession": {
      args: [FfiType2.Handle],
      ret: FfiType2.Void,
      hasRustCallStatus: true
    },
    "uniffi_cua_driver_sdk_fn_clone_driveractivityobserver": {
      args: [FfiType2.Handle],
      ret: FfiType2.Handle,
      hasRustCallStatus: true
    },
    "uniffi_cua_driver_sdk_fn_free_driveractivityobserver": {
      args: [FfiType2.Handle],
      ret: FfiType2.Void,
      hasRustCallStatus: true
    },
    "uniffi_cua_driver_sdk_fn_clone_driverauthorizationhost": {
      args: [FfiType2.Handle],
      ret: FfiType2.Handle,
      hasRustCallStatus: true
    },
    "uniffi_cua_driver_sdk_fn_free_driverauthorizationhost": {
      args: [FfiType2.Handle],
      ret: FfiType2.Void,
      hasRustCallStatus: true
    },
    "uniffi_cua_driver_sdk_fn_clone_driverservicetransport": {
      args: [FfiType2.Handle],
      ret: FfiType2.Handle,
      hasRustCallStatus: true
    },
    "uniffi_cua_driver_sdk_fn_free_driverservicetransport": {
      args: [FfiType2.Handle],
      ret: FfiType2.Void,
      hasRustCallStatus: true
    },
    "uniffi_cua_driver_sdk_fn_clone_embeddedcuadriverhost": {
      args: [FfiType2.Handle],
      ret: FfiType2.Handle,
      hasRustCallStatus: true
    },
    "uniffi_cua_driver_sdk_fn_free_embeddedcuadriverhost": {
      args: [FfiType2.Handle],
      ret: FfiType2.Void,
      hasRustCallStatus: true
    },
    "uniffi_cua_driver_sdk_fn_clone_foreigndriverenvelopechannel": {
      args: [FfiType2.Handle],
      ret: FfiType2.Handle,
      hasRustCallStatus: true
    },
    "uniffi_cua_driver_sdk_fn_free_foreigndriverenvelopechannel": {
      args: [FfiType2.Handle],
      ret: FfiType2.Void,
      hasRustCallStatus: true
    },
    "uniffi_cua_driver_sdk_fn_clone_mcpdriverchannel": {
      args: [FfiType2.Handle],
      ret: FfiType2.Handle,
      hasRustCallStatus: true
    },
    "uniffi_cua_driver_sdk_fn_free_mcpdriverchannel": {
      args: [FfiType2.Handle],
      ret: FfiType2.Void,
      hasRustCallStatus: true
    },
    "uniffi_cua_driver_sdk_fn_init_callback_vtable_driveractivityobserver": {
      args: [FfiType2.Reference(FfiType2.Struct("VTableCallbackInterfaceCuaDriverSdkDriverActivityObserver"))],
      ret: FfiType2.Void,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_init_callback_vtable_driverauthorizationhost": {
      args: [FfiType2.Reference(FfiType2.Struct("VTableCallbackInterfaceCuaDriverSdkDriverAuthorizationHost"))],
      ret: FfiType2.Void,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_init_callback_vtable_driverservicetransport": {
      args: [FfiType2.Reference(FfiType2.Struct("VTableCallbackInterfaceCuaDriverSdkDriverServiceTransport"))],
      ret: FfiType2.Void,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_init_callback_vtable_foreigndriverenvelopechannel": {
      args: [FfiType2.Reference(FfiType2.Struct("VTableCallbackInterfaceCuaDriverSdkForeignDriverEnvelopeChannel"))],
      ret: FfiType2.Void,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_func_connect_remote_channel": {
      args: [FfiType2.Handle],
      ret: FfiType2.Handle,
      hasRustCallStatus: true
    },
    "uniffi_cua_driver_sdk_fn_func_create_remote_trusted_session": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_func_create_trusted_session": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: true
    },
    "uniffi_cua_driver_sdk_fn_func_current_mac_os_permission_status": {
      args: [],
      ret: FfiType2.RustBuffer,
      hasRustCallStatus: true
    },
    "uniffi_cua_driver_sdk_fn_func_open_mac_os_screen_recording_settings": {
      args: [],
      ret: FfiType2.Void,
      hasRustCallStatus: true
    },
    "uniffi_cua_driver_sdk_fn_func_open_mcp_driver_channel": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: true
    },
    "uniffi_cua_driver_sdk_fn_func_request_mac_os_permissions": {
      args: [],
      ret: FfiType2.RustBuffer,
      hasRustCallStatus: true
    },
    "uniffi_cua_driver_sdk_fn_constructor_cuadriver_connect": {
      args: [FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: true
    },
    "uniffi_cua_driver_sdk_fn_constructor_cuadriver_connect_with_client_kind": {
      args: [FfiType2.RustBuffer, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: true
    },
    "uniffi_cua_driver_sdk_fn_constructor_cuadriver_create": {
      args: [FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: true
    },
    "uniffi_cua_driver_sdk_fn_constructor_cuadriver_create_configured": {
      args: [FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: true
    },
    "uniffi_cua_driver_sdk_fn_constructor_cuadriver_create_configured_with_activity_observer": {
      args: [FfiType2.RustBuffer, FfiType2.Handle],
      ret: FfiType2.Handle,
      hasRustCallStatus: true
    },
    "uniffi_cua_driver_sdk_fn_constructor_cuadriver_create_configured_with_activity_observer_and_client_kind": {
      args: [FfiType2.RustBuffer, FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: true
    },
    "uniffi_cua_driver_sdk_fn_constructor_cuadriver_create_configured_with_authorization_host": {
      args: [FfiType2.RustBuffer, FfiType2.Handle],
      ret: FfiType2.Handle,
      hasRustCallStatus: true
    },
    "uniffi_cua_driver_sdk_fn_constructor_cuadriver_create_configured_with_authorization_host_and_client_kind": {
      args: [FfiType2.RustBuffer, FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: true
    },
    "uniffi_cua_driver_sdk_fn_constructor_cuadriver_create_configured_with_client_kind": {
      args: [FfiType2.RustBuffer, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: true
    },
    "uniffi_cua_driver_sdk_fn_constructor_cuadriver_create_configured_with_host_integrations": {
      args: [FfiType2.RustBuffer, FfiType2.Handle, FfiType2.Handle],
      ret: FfiType2.Handle,
      hasRustCallStatus: true
    },
    "uniffi_cua_driver_sdk_fn_constructor_cuadriver_create_configured_with_host_integrations_and_client_kind": {
      args: [FfiType2.RustBuffer, FfiType2.Handle, FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: true
    },
    "uniffi_cua_driver_sdk_fn_constructor_cuadriver_create_private_worker": {
      args: [FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: true
    },
    "uniffi_cua_driver_sdk_fn_constructor_cuadriver_create_private_worker_with_client_kind": {
      args: [FfiType2.RustBuffer, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: true
    },
    "uniffi_cua_driver_sdk_fn_constructor_cuadriver_create_with_client_kind": {
      args: [FfiType2.RustBuffer, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: true
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriver_call_tool": {
      args: [FfiType2.Handle, FfiType2.RustBuffer, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriver_click": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriver_clipboard_read": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriver_clipboard_write": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriver_drag": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriver_end_session": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriver_escalate_session": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriver_execution_mode": {
      args: [FfiType2.Handle],
      ret: FfiType2.RustBuffer,
      hasRustCallStatus: true
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriver_get_agent_cursor_state": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriver_get_cursor_position": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriver_get_desktop_state": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriver_get_screen_size": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriver_get_session": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriver_get_session_state": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriver_get_window_state": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriver_hotkey": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriver_invoke_menu": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriver_is_available": {
      args: [FfiType2.Handle],
      ret: FfiType2.Int8,
      hasRustCallStatus: true
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriver_list_apps": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriver_list_host_sessions_json": {
      args: [FfiType2.Handle],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriver_list_sessions": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriver_list_tools_json": {
      args: [FfiType2.Handle],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriver_list_windows": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriver_metadata": {
      args: [FfiType2.Handle],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriver_move_cursor": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriver_press_key": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriver_runtime_scope_prefix": {
      args: [FfiType2.Handle],
      ret: FfiType2.RustBuffer,
      hasRustCallStatus: true
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriver_scroll": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriver_set_agent_cursor_enabled": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriver_set_agent_cursor_motion": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriver_set_agent_cursor_theme": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriver_set_window_frame": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriver_shutdown": {
      args: [FfiType2.Handle],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriver_socket_path": {
      args: [FfiType2.Handle],
      ret: FfiType2.RustBuffer,
      hasRustCallStatus: true
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriver_start_session": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriver_type_text": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriver_verify_state": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriversession_call_tool": {
      args: [FfiType2.Handle, FfiType2.RustBuffer, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriversession_click": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriversession_clipboard_read": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriversession_clipboard_write": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriversession_close": {
      args: [FfiType2.Handle],
      ret: FfiType2.Void,
      hasRustCallStatus: true
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriversession_drag": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriversession_end_session": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriversession_escalate_session": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriversession_get_agent_cursor_state": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriversession_get_cursor_position": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriversession_get_desktop_state": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriversession_get_screen_size": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriversession_get_session": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriversession_get_session_state": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriversession_get_window_state": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriversession_hotkey": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriversession_invoke_menu": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriversession_list_apps": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriversession_list_sessions": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriversession_list_windows": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriversession_move_cursor": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriversession_press_key": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriversession_scroll": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriversession_set_agent_cursor_enabled": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriversession_set_agent_cursor_motion": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriversession_set_agent_cursor_theme": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriversession_set_window_frame": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriversession_start_session": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriversession_type_text": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_cuadriversession_verify_state": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_driveractivityobserver_on_activity": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Void,
      hasRustCallStatus: true
    },
    "uniffi_cua_driver_sdk_fn_method_driverauthorizationhost_authorize": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_driverservicetransport_send": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_constructor_embeddedcuadriverhost_new": {
      args: [FfiType2.RustBuffer, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: true
    },
    "uniffi_cua_driver_sdk_fn_constructor_embeddedcuadriverhost_with_options": {
      args: [FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: true
    },
    "uniffi_cua_driver_sdk_fn_method_embeddedcuadriverhost_connection": {
      args: [FfiType2.Handle],
      ret: FfiType2.RustBuffer,
      hasRustCallStatus: true
    },
    "uniffi_cua_driver_sdk_fn_method_embeddedcuadriverhost_restart": {
      args: [FfiType2.Handle],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_embeddedcuadriverhost_start": {
      args: [FfiType2.Handle],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_embeddedcuadriverhost_state": {
      args: [FfiType2.Handle],
      ret: FfiType2.RustBuffer,
      hasRustCallStatus: true
    },
    "uniffi_cua_driver_sdk_fn_method_embeddedcuadriverhost_stop": {
      args: [FfiType2.Handle],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_embeddedcuadriverhost_wait_for_exit": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_foreigndriverenvelopechannel_identity": {
      args: [FfiType2.Handle],
      ret: FfiType2.RustBuffer,
      hasRustCallStatus: true
    },
    "uniffi_cua_driver_sdk_fn_method_foreigndriverenvelopechannel_negotiate": {
      args: [FfiType2.Handle],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_foreigndriverenvelopechannel_exchange": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_foreigndriverenvelopechannel_bind_session": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_foreigndriverenvelopechannel_cancel": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_foreigndriverenvelopechannel_close": {
      args: [FfiType2.Handle],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_mcpdriverchannel_close": {
      args: [FfiType2.Handle],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_mcpdriverchannel_driver": {
      args: [FfiType2.Handle],
      ret: FfiType2.Handle,
      hasRustCallStatus: true
    },
    "uniffi_cua_driver_sdk_fn_method_mcpdriverchannel_open": {
      args: [FfiType2.Handle],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_fn_method_mcpdriverchannel_public_session": {
      args: [FfiType2.Handle],
      ret: FfiType2.RustBuffer,
      hasRustCallStatus: true
    },
    "ffi_cua_driver_sdk_uniffi_contract_version": {
      args: [],
      ret: FfiType2.UInt32,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_func_connect_remote_channel": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_func_create_remote_trusted_session": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_func_create_trusted_session": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_func_current_mac_os_permission_status": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_func_open_mac_os_screen_recording_settings": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_func_open_mcp_driver_channel": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_func_request_mac_os_permissions": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_constructor_cuadriver_connect": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_constructor_cuadriver_connect_with_client_kind": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_constructor_cuadriver_create": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_constructor_cuadriver_create_configured": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_constructor_cuadriver_create_configured_with_activity_observer": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_constructor_cuadriver_create_configured_with_activity_observer_and_client_kind": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_constructor_cuadriver_create_configured_with_authorization_host": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_constructor_cuadriver_create_configured_with_authorization_host_and_client_kind": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_constructor_cuadriver_create_configured_with_client_kind": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_constructor_cuadriver_create_configured_with_host_integrations": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_constructor_cuadriver_create_configured_with_host_integrations_and_client_kind": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_constructor_cuadriver_create_private_worker": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_constructor_cuadriver_create_private_worker_with_client_kind": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_constructor_cuadriver_create_with_client_kind": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriver_call_tool": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriver_click": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriver_clipboard_read": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriver_clipboard_write": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriver_drag": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriver_end_session": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriver_escalate_session": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriver_execution_mode": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriver_get_agent_cursor_state": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriver_get_cursor_position": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriver_get_desktop_state": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriver_get_screen_size": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriver_get_session": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriver_get_session_state": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriver_get_window_state": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriver_hotkey": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriver_invoke_menu": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriver_is_available": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriver_list_apps": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriver_list_host_sessions_json": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriver_list_sessions": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriver_list_tools_json": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriver_list_windows": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriver_metadata": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriver_move_cursor": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriver_press_key": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriver_runtime_scope_prefix": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriver_scroll": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriver_set_agent_cursor_enabled": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriver_set_agent_cursor_motion": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriver_set_agent_cursor_theme": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriver_set_window_frame": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriver_shutdown": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriver_socket_path": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriver_start_session": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriver_type_text": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriver_verify_state": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriversession_call_tool": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriversession_click": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriversession_clipboard_read": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriversession_clipboard_write": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriversession_close": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriversession_drag": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriversession_end_session": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriversession_escalate_session": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriversession_get_agent_cursor_state": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriversession_get_cursor_position": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriversession_get_desktop_state": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriversession_get_screen_size": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriversession_get_session": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriversession_get_session_state": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriversession_get_window_state": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriversession_hotkey": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriversession_invoke_menu": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriversession_list_apps": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriversession_list_sessions": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriversession_list_windows": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriversession_move_cursor": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriversession_press_key": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriversession_scroll": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriversession_set_agent_cursor_enabled": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriversession_set_agent_cursor_motion": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriversession_set_agent_cursor_theme": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriversession_set_window_frame": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriversession_start_session": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriversession_type_text": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_cuadriversession_verify_state": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_driveractivityobserver_on_activity": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_driverauthorizationhost_authorize": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_driverservicetransport_send": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_constructor_embeddedcuadriverhost_new": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_constructor_embeddedcuadriverhost_with_options": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_embeddedcuadriverhost_connection": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_embeddedcuadriverhost_restart": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_embeddedcuadriverhost_start": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_embeddedcuadriverhost_state": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_embeddedcuadriverhost_stop": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_embeddedcuadriverhost_wait_for_exit": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_foreigndriverenvelopechannel_identity": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_foreigndriverenvelopechannel_negotiate": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_foreigndriverenvelopechannel_exchange": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_foreigndriverenvelopechannel_bind_session": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_foreigndriverenvelopechannel_cancel": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_foreigndriverenvelopechannel_close": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_mcpdriverchannel_close": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_mcpdriverchannel_driver": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_mcpdriverchannel_open": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    },
    "uniffi_cua_driver_sdk_checksum_method_mcpdriverchannel_public_session": {
      args: [],
      ret: FfiType2.UInt16,
      hasRustCallStatus: false
    }
  },
  callbacks: {
    "RustFutureContinuationCallback": {
      args: [FfiType2.Handle, FfiType2.Int8],
      ret: FfiType2.Void,
      hasRustCallStatus: false
    },
    "ForeignFutureDroppedCallback": {
      args: [FfiType2.Handle],
      ret: FfiType2.Void,
      hasRustCallStatus: false
    },
    "CallbackInterfaceCuaDriverSdkDriverActivityObserverMethod0": {
      args: [FfiType2.Handle, FfiType2.RustBuffer],
      ret: FfiType2.VoidPointer,
      hasRustCallStatus: true,
      outReturn: true
    },
    "CallbackInterfaceCloneCuaDriverSdk_DriverActivityObserver": {
      args: [FfiType2.Handle],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "CallbackInterfaceFreeCuaDriverSdk_DriverActivityObserver": {
      args: [FfiType2.Handle],
      ret: FfiType2.Void,
      hasRustCallStatus: false
    },
    "ForeignFutureCompleterust_buffer": {
      args: [FfiType2.Handle, FfiType2.Struct("ForeignFutureResultRustBuffer")],
      ret: FfiType2.Void,
      hasRustCallStatus: false
    },
    "CallbackInterfaceCuaDriverSdkDriverAuthorizationHostMethod0": {
      args: [FfiType2.Handle, FfiType2.RustBuffer, FfiType2.Callback("ForeignFutureCompleterust_buffer"), FfiType2.Handle],
      ret: FfiType2.Struct("ForeignFutureDroppedCallbackStruct"),
      hasRustCallStatus: false,
      outReturn: true
    },
    "CallbackInterfaceCloneCuaDriverSdk_DriverAuthorizationHost": {
      args: [FfiType2.Handle],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "CallbackInterfaceFreeCuaDriverSdk_DriverAuthorizationHost": {
      args: [FfiType2.Handle],
      ret: FfiType2.Void,
      hasRustCallStatus: false
    },
    "CallbackInterfaceCuaDriverSdkDriverServiceTransportMethod0": {
      args: [FfiType2.Handle, FfiType2.RustBuffer, FfiType2.Callback("ForeignFutureCompleterust_buffer"), FfiType2.Handle],
      ret: FfiType2.Struct("ForeignFutureDroppedCallbackStruct"),
      hasRustCallStatus: false,
      outReturn: true
    },
    "CallbackInterfaceCloneCuaDriverSdk_DriverServiceTransport": {
      args: [FfiType2.Handle],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "CallbackInterfaceFreeCuaDriverSdk_DriverServiceTransport": {
      args: [FfiType2.Handle],
      ret: FfiType2.Void,
      hasRustCallStatus: false
    },
    "CallbackInterfaceCuaDriverSdkForeignDriverEnvelopeChannelMethod0": {
      args: [FfiType2.Handle],
      ret: FfiType2.RustBuffer,
      hasRustCallStatus: true,
      outReturn: true
    },
    "CallbackInterfaceCuaDriverSdkForeignDriverEnvelopeChannelMethod1": {
      args: [FfiType2.Handle, FfiType2.Callback("ForeignFutureCompleterust_buffer"), FfiType2.Handle],
      ret: FfiType2.Struct("ForeignFutureDroppedCallbackStruct"),
      hasRustCallStatus: false,
      outReturn: true
    },
    "CallbackInterfaceCuaDriverSdkForeignDriverEnvelopeChannelMethod2": {
      args: [FfiType2.Handle, FfiType2.RustBuffer, FfiType2.Callback("ForeignFutureCompleterust_buffer"), FfiType2.Handle],
      ret: FfiType2.Struct("ForeignFutureDroppedCallbackStruct"),
      hasRustCallStatus: false,
      outReturn: true
    },
    "CallbackInterfaceCuaDriverSdkForeignDriverEnvelopeChannelMethod3": {
      args: [FfiType2.Handle, FfiType2.RustBuffer, FfiType2.Callback("ForeignFutureCompleterust_buffer"), FfiType2.Handle],
      ret: FfiType2.Struct("ForeignFutureDroppedCallbackStruct"),
      hasRustCallStatus: false,
      outReturn: true
    },
    "ForeignFutureCompletevoid": {
      args: [FfiType2.Handle, FfiType2.Struct("ForeignFutureResultVoid")],
      ret: FfiType2.Void,
      hasRustCallStatus: false
    },
    "CallbackInterfaceCuaDriverSdkForeignDriverEnvelopeChannelMethod4": {
      args: [FfiType2.Handle, FfiType2.RustBuffer, FfiType2.Callback("ForeignFutureCompletevoid"), FfiType2.Handle],
      ret: FfiType2.Struct("ForeignFutureDroppedCallbackStruct"),
      hasRustCallStatus: false,
      outReturn: true
    },
    "CallbackInterfaceCuaDriverSdkForeignDriverEnvelopeChannelMethod5": {
      args: [FfiType2.Handle, FfiType2.Callback("ForeignFutureCompletevoid"), FfiType2.Handle],
      ret: FfiType2.Struct("ForeignFutureDroppedCallbackStruct"),
      hasRustCallStatus: false,
      outReturn: true
    },
    "CallbackInterfaceCloneCuaDriverSdk_ForeignDriverEnvelopeChannel": {
      args: [FfiType2.Handle],
      ret: FfiType2.Handle,
      hasRustCallStatus: false
    },
    "CallbackInterfaceFreeCuaDriverSdk_ForeignDriverEnvelopeChannel": {
      args: [FfiType2.Handle],
      ret: FfiType2.Void,
      hasRustCallStatus: false
    }
  },
  structs: {
    "ForeignFutureDroppedCallbackStruct": [
      { name: "handle", type: FfiType2.Handle },
      { name: "free", type: FfiType2.Callback("ForeignFutureDroppedCallback") }
    ],
    "VTableCallbackInterfaceCuaDriverSdkDriverActivityObserver": [
      { name: "uniffi_free", type: FfiType2.Callback("CallbackInterfaceFreeCuaDriverSdk_DriverActivityObserver") },
      { name: "uniffi_clone", type: FfiType2.Callback("CallbackInterfaceCloneCuaDriverSdk_DriverActivityObserver") },
      { name: "on_activity", type: FfiType2.Callback("CallbackInterfaceCuaDriverSdkDriverActivityObserverMethod0") }
    ],
    "ForeignFutureResultRustBuffer": [
      { name: "return_value", type: FfiType2.RustBuffer },
      { name: "call_status", type: FfiType2.RustCallStatus }
    ],
    "VTableCallbackInterfaceCuaDriverSdkDriverAuthorizationHost": [
      { name: "uniffi_free", type: FfiType2.Callback("CallbackInterfaceFreeCuaDriverSdk_DriverAuthorizationHost") },
      { name: "uniffi_clone", type: FfiType2.Callback("CallbackInterfaceCloneCuaDriverSdk_DriverAuthorizationHost") },
      { name: "authorize", type: FfiType2.Callback("CallbackInterfaceCuaDriverSdkDriverAuthorizationHostMethod0") }
    ],
    "VTableCallbackInterfaceCuaDriverSdkDriverServiceTransport": [
      { name: "uniffi_free", type: FfiType2.Callback("CallbackInterfaceFreeCuaDriverSdk_DriverServiceTransport") },
      { name: "uniffi_clone", type: FfiType2.Callback("CallbackInterfaceCloneCuaDriverSdk_DriverServiceTransport") },
      { name: "send", type: FfiType2.Callback("CallbackInterfaceCuaDriverSdkDriverServiceTransportMethod0") }
    ],
    "ForeignFutureResultVoid": [
      { name: "call_status", type: FfiType2.RustCallStatus }
    ],
    "VTableCallbackInterfaceCuaDriverSdkForeignDriverEnvelopeChannel": [
      { name: "uniffi_free", type: FfiType2.Callback("CallbackInterfaceFreeCuaDriverSdk_ForeignDriverEnvelopeChannel") },
      { name: "uniffi_clone", type: FfiType2.Callback("CallbackInterfaceCloneCuaDriverSdk_ForeignDriverEnvelopeChannel") },
      { name: "identity", type: FfiType2.Callback("CallbackInterfaceCuaDriverSdkForeignDriverEnvelopeChannelMethod0") },
      { name: "negotiate", type: FfiType2.Callback("CallbackInterfaceCuaDriverSdkForeignDriverEnvelopeChannelMethod1") },
      { name: "exchange", type: FfiType2.Callback("CallbackInterfaceCuaDriverSdkForeignDriverEnvelopeChannelMethod2") },
      { name: "bind_session", type: FfiType2.Callback("CallbackInterfaceCuaDriverSdkForeignDriverEnvelopeChannelMethod3") },
      { name: "cancel", type: FfiType2.Callback("CallbackInterfaceCuaDriverSdkForeignDriverEnvelopeChannelMethod4") },
      { name: "close", type: FfiType2.Callback("CallbackInterfaceCuaDriverSdkForeignDriverEnvelopeChannelMethod5") }
    ]
  }
};
var _nativeModule;
var getter = () => {
  if (!_nativeModule) {
    const libPath = resolveLibPath2({
      crateName: "cua_driver_sdk",
      callerUrl: import.meta.url,
      npmPackageBase: "@trycua/cua-driver-",
      tripleStyle: "node"
    });
    const mod_ = UniffiNativeModule2.open(libPath);
    _nativeModule = mod_.register(DEFINITIONS);
  }
  return _nativeModule;
};
var cua_driver_sdk_ffi_default = getter;

// node_modules/.pnpm/@ubjs+core@0.31.0-3/node_modules/@ubjs/core/dist/esm/symbols.js
var destructorGuardSymbol = /* @__PURE__ */ Symbol.for("destructor");
var pointerLiteralSymbol = /* @__PURE__ */ Symbol.for("pointer");
var uniffiTypeNameSymbol = /* @__PURE__ */ Symbol.for("typeName");

// node_modules/.pnpm/@ubjs+core@0.31.0-3/node_modules/@ubjs/core/dist/esm/errors.js
var UniffiError = class extends Error {
  constructor(enumTypeName, variantName, message) {
    super(createErrorMessage(enumTypeName, variantName, message));
  }
  static instanceOf(obj) {
    return obj[uniffiTypeNameSymbol] !== void 0 && obj instanceof Error;
  }
};
function createErrorMessage(typeName, variantName, message) {
  const prefix = `${typeName}.${variantName}`;
  if (message) {
    return `${prefix}: ${message}`;
  } else {
    return prefix;
  }
}
var UniffiInternalError = /* @__PURE__ */ (() => {
  class NumberOverflow extends Error {
    constructor() {
      super("Cannot convert a large BigInt into a number");
    }
  }
  class DateTimeOverflow extends Error {
    constructor() {
      super("Date overflowed passed maximum number of ms passed the epoch");
    }
  }
  class BufferOverflow extends Error {
    constructor() {
      super("Reading the requested value would read past the end of the buffer");
    }
  }
  class IncompleteData extends Error {
    constructor() {
      super("The buffer still has data after lifting its containing value");
    }
  }
  class AbortError extends Error {
    constructor() {
      super("A Rust future was aborted");
      this.name = "AbortError";
    }
  }
  class UnexpectedEnumCase extends Error {
    constructor() {
      super("Raw enum value doesn't match any cases");
    }
  }
  class UnexpectedNullPointer extends Error {
    constructor() {
      super("Raw pointer value was null");
    }
  }
  class UnexpectedRustCallStatusCode extends Error {
    constructor() {
      super("Unexpected UniffiRustCallStatus code");
    }
  }
  class UnexpectedRustCallError extends Error {
    constructor() {
      super("CALL_ERROR but no errorClass specified");
    }
  }
  class UnexpectedStaleHandle extends Error {
    constructor() {
      super("The object is no longer in the handle map, likely because of a hot-reload");
    }
  }
  class ContractVersionMismatch extends Error {
    constructor(rustVersion, bindingsVersion) {
      super(`Incompatible versions of uniffi were used to build the JS (${bindingsVersion}) from the Rust (${rustVersion})`);
    }
  }
  class ApiChecksumMismatch extends Error {
    constructor(func) {
      super(`FFI function ${func} has a checksum mismatch; this may signify previously undetected incompatible Uniffi versions`);
    }
  }
  class RustPanic extends Error {
    constructor(message) {
      super(message);
    }
  }
  class Unimplemented extends Error {
    constructor(message) {
      super(message);
    }
  }
  return {
    ApiChecksumMismatch,
    NumberOverflow,
    DateTimeOverflow,
    BufferOverflow,
    ContractVersionMismatch,
    IncompleteData,
    AbortError,
    UnexpectedEnumCase,
    UnexpectedNullPointer,
    UnexpectedRustCallStatusCode,
    UnexpectedRustCallError,
    UnexpectedStaleHandle,
    RustPanic,
    Unimplemented
  };
})();

// node_modules/.pnpm/@ubjs+core@0.31.0-3/node_modules/@ubjs/core/dist/esm/rust-call.js
var CALL_SUCCESS = 0;
var CALL_ERROR = 1;
var CALL_UNEXPECTED_ERROR = 2;
var CALL_CANCELLED = 3;
var emptyStringLifter = (bytes) => "An error occurred decoding a string";
var UniffiRustCaller = class {
  statusConstructor;
  constructor(statusConstructor) {
    this.statusConstructor = statusConstructor;
  }
  rustCall(caller, liftString = emptyStringLifter) {
    return this.makeRustCall(caller, liftString);
  }
  rustCallWithError(errorHandler, caller, liftString = emptyStringLifter) {
    return this.makeRustCall(caller, liftString, errorHandler);
  }
  createCallStatus() {
    return this.statusConstructor();
  }
  createErrorStatus(code, errorBuf) {
    const status = this.statusConstructor();
    status.code = code;
    status.errorBuf = errorBuf;
    return status;
  }
  makeRustCall(caller, liftString, errorHandler) {
    const callStatus = this.statusConstructor();
    let returnedVal = caller(callStatus);
    uniffiCheckCallStatus(callStatus, liftString, errorHandler);
    return returnedVal;
  }
};
function uniffiCheckCallStatus(callStatus, liftString, errorHandler) {
  switch (callStatus.code) {
    case CALL_SUCCESS:
      return;
    case CALL_ERROR: {
      const errorBuf = callStatus.errorBuf;
      if (errorBuf) {
        if (errorHandler) {
          throw errorHandler(errorBuf);
        }
      }
      throw new UniffiInternalError.UnexpectedRustCallError();
    }
    case CALL_UNEXPECTED_ERROR: {
      const errorBuf = callStatus.errorBuf;
      if (errorBuf) {
        if (errorBuf.byteLength > 0) {
          throw new UniffiInternalError.RustPanic(liftString(errorBuf));
        }
      }
      throw new UniffiInternalError.RustPanic("Rust panic");
    }
    case CALL_CANCELLED:
      throw new UniffiInternalError.AbortError();
    default:
      throw new UniffiInternalError.UnexpectedRustCallStatusCode();
  }
}

// node_modules/.pnpm/@ubjs+core@0.31.0-3/node_modules/@ubjs/core/dist/esm/handle-map.js
var defaultUniffiHandle = BigInt("0");
var UniffiHandleMap = class {
  map = /* @__PURE__ */ new Map();
  // Foreign handles must be odd values per uniffi 0.30.x:
  // "Foreign handles are generated with a handle map that only generates odd values."
  // "Foreign handles must always have the lowest bit set"
  // "0 is an invalid value."
  currentHandle = BigInt(1);
  insert(value) {
    const handle = this.currentHandle;
    this.map.set(handle, value);
    this.currentHandle += BigInt(2);
    return handle;
  }
  get(handle) {
    const obj = this.map.get(handle);
    if (obj === void 0) {
      throw new UniffiInternalError.UnexpectedStaleHandle();
    }
    return obj;
  }
  /**
   * Creates a second handle pointing to the same object. Rust calls this (via
   * `CallbackInterfaceClone`) when it clones an Arc holding a foreign-implemented
   * trait object, so two Arc references can exist with independent lifetimes.
   *
   * This clones the *handle*, not the object itself. Both handles resolve to the
   * same JS object reference, and removing either handle does not affect the other.
   */
  clone(handle) {
    const obj = this.map.get(handle);
    if (obj === void 0) {
      throw new UniffiInternalError.UnexpectedStaleHandle();
    }
    return this.insert(obj);
  }
  remove(handle) {
    const obj = this.map.get(handle);
    if (obj !== void 0) {
      this.map.delete(handle);
    }
    return obj;
  }
  has(handle) {
    return this.map.has(handle);
  }
  get size() {
    return this.map.size;
  }
};

// node_modules/.pnpm/@ubjs+core@0.31.0-3/node_modules/@ubjs/core/dist/esm/async-callbacks.js
var UNIFFI_FOREIGN_FUTURE_HANDLE_MAP = new UniffiHandleMap();
function uniffiTraitInterfaceCallAsyncWithError(makeCall, handleSuccess, handleError, isErrorType, lowerError, lowerString, alloc) {
  const settledHolder = { settled: false };
  const abortController = new AbortController();
  const promise = makeCall(abortController.signal).finally(() => settledHolder.settled = true).then(handleSuccess, (error) => {
    let message = error.message ? error.message : error.toString();
    if (isErrorType(error)) {
      try {
        handleError(CALL_ERROR, lowerError(error, alloc));
        return;
      } catch (e) {
        message = `Error handling error "${e}", originally: "${message}"`;
      }
    }
    handleError(CALL_UNEXPECTED_ERROR, lowerString(message, alloc));
  });
  const promiseHelper = { abortController, settledHolder, promise };
  const handle = UNIFFI_FOREIGN_FUTURE_HANDLE_MAP.insert(promiseHelper);
  return (
    /* UniffiForeignFuture */
    {
      handle,
      free: uniffiForeignFutureFree
    }
  );
}
function uniffiForeignFutureFree(handle) {
  const helper = UNIFFI_FOREIGN_FUTURE_HANDLE_MAP.remove(handle);
  if (helper?.settledHolder.settled === false) {
    helper.abortController.abort();
  }
}

// node_modules/.pnpm/@ubjs+core@0.31.0-3/node_modules/@ubjs/core/dist/esm/async-rust-call.js
var UNIFFI_RUST_FUTURE_POLL_READY = 0;
async function uniffiRustCallAsync(rustCaller, rustFutureFunc, pollFunc, cancelFunc, completeFunc, freeFunc, liftFunc, liftString, asyncOpts, errorHandler) {
  if (asyncOpts?.signal.aborted === true) {
    return Promise.reject(new UniffiInternalError.AbortError());
  }
  const rustFuture = rustFutureFunc();
  const abortFunc = createAbortFunction(rustFuture, cancelFunc);
  asyncOpts?.signal.addEventListener("abort", abortFunc);
  const keepAlive = typeof setTimeout === "function" ? setTimeout(() => {
  }, 2147483647) : void 0;
  try {
    let pollResult;
    do {
      pollResult = await pollRust((handle) => {
        pollFunc(rustFuture, uniffiFutureContinuationCallback, handle);
      });
    } while (pollResult !== UNIFFI_RUST_FUTURE_POLL_READY);
    return liftFunc(rustCaller.makeRustCall((status) => completeFunc(rustFuture, status), liftString, errorHandler));
  } finally {
    if (keepAlive !== void 0)
      clearTimeout(keepAlive);
    asyncOpts?.signal.removeEventListener("abort", abortFunc);
    freeFunc(rustFuture);
  }
}
var UNIFFI_RUST_FUTURE_RESOLVER_MAP = new UniffiHandleMap();
async function pollRust(pollFunc) {
  return new Promise((resolve) => {
    const handle = UNIFFI_RUST_FUTURE_RESOLVER_MAP.insert(resolve);
    pollFunc(handle);
  });
}
function createAbortFunction(rustFuture, cancelFunc) {
  return () => cancelFunc(rustFuture);
}
var uniffiFutureContinuationCallback = (handle, pollResult) => {
  const resolve = UNIFFI_RUST_FUTURE_RESOLVER_MAP.remove(handle);
  if (resolve) {
    resolve(pollResult);
  }
};

// node_modules/.pnpm/@ubjs+core@0.31.0-3/node_modules/@ubjs/core/dist/esm/ffi-types.js
var RustBuffer = class _RustBuffer {
  readOffset = 0;
  writeOffset = 0;
  capacity;
  arrayBuffer;
  constructor(arrayBuffer) {
    this.arrayBuffer = arrayBuffer;
    this.capacity = arrayBuffer.byteLength;
  }
  /**
   * Allocate a JS-owned buffer of the given capacity. Used by tests; not by
   * the runtime path, which calls `RustBuffer.fromUint8Array(allocator(n))`
   * with a runtime-supplied allocator.
   */
  static withCapacity(capacity) {
    const buf = new ArrayBuffer(capacity);
    return new _RustBuffer(buf);
  }
  static empty() {
    return this.withCapacity(0);
  }
  static fromArrayBuffer(buf) {
    return new _RustBuffer(buf);
  }
  /**
   * Construct a `RustBuffer` over a `Uint8Array` view. Cursors track absolute
   * offsets into the backing `ArrayBuffer`, so `byteOffset` and `byteLength`
   * delimit the readable/writable region.
   */
  static fromUint8Array(view) {
    const buf = new _RustBuffer(view.buffer);
    buf.readOffset = view.byteOffset;
    buf.writeOffset = view.byteOffset;
    buf.capacity = view.byteOffset + view.byteLength;
    return buf;
  }
  get length() {
    return this.arrayBuffer.byteLength;
  }
  get byteArray() {
    return new Uint8Array(this.arrayBuffer);
  }
  readArrayBuffer(numBytes) {
    const start = this.readOffset;
    const end = this.checkOverflow(start, numBytes);
    const value = this.arrayBuffer.slice(start, end);
    this.readOffset = end;
    return value;
  }
  readByteArray(numBytes) {
    const start = this.readOffset;
    const end = this.checkOverflow(start, numBytes);
    const value = new Uint8Array(this.arrayBuffer, start, numBytes);
    this.readOffset = end;
    return value;
  }
  writeArrayBuffer(buffer) {
    const start = this.writeOffset;
    const end = this.checkOverflow(start, buffer.byteLength);
    const src = new Uint8Array(buffer);
    const dest = new Uint8Array(this.arrayBuffer, start);
    dest.set(src);
    this.writeOffset = end;
  }
  writeByteArray(src) {
    const start = this.writeOffset;
    const end = this.checkOverflow(start, src.byteLength);
    const dest = new Uint8Array(this.arrayBuffer, start);
    dest.set(src);
    this.writeOffset = end;
  }
  readWithView(numBytes, reader) {
    const start = this.readOffset;
    const end = this.checkOverflow(start, numBytes);
    const view = new DataView(this.arrayBuffer, start, numBytes);
    const value = reader(view);
    this.readOffset = end;
    return value;
  }
  writeWithView(numBytes, writer) {
    const start = this.writeOffset;
    const end = this.checkOverflow(start, numBytes);
    const view = new DataView(this.arrayBuffer, start, numBytes);
    writer(view);
    this.writeOffset = end;
  }
  /**
   * Advance the read cursor by `numBytes` and return the starting offset.
   * Used to construct a typed-array view directly over the backing store.
   */
  advanceReadOffset(numBytes) {
    const start = this.readOffset;
    this.readOffset = this.checkOverflow(start, numBytes);
    return start;
  }
  /**
   * Advance the write cursor by `numBytes` and return the starting offset.
   * Used to construct a typed-array view directly over the backing store.
   */
  advanceWriteOffset(numBytes) {
    const start = this.writeOffset;
    this.writeOffset = this.checkOverflow(start, numBytes);
    return start;
  }
  /**
   * Set the write cursor to an absolute position. Used to backfill after an
   * in-place encode reports the actual number of bytes written.
   */
  setWriteOffset(offset) {
    if (offset > this.capacity) {
      throw new UniffiInternalError.BufferOverflow();
    }
    this.writeOffset = offset;
  }
  checkOverflow(start, numBytes) {
    const end = start + numBytes;
    if (this.capacity < end) {
      throw new UniffiInternalError.BufferOverflow();
    }
    return end;
  }
};

// node_modules/.pnpm/@ubjs+core@0.31.0-3/node_modules/@ubjs/core/dist/esm/ffi-converters.js
var FfiConverterPrimitive = class {
  lift(value) {
    return value;
  }
  lower(value, _alloc) {
    return value;
  }
};
var AbstractFfiConverterByteArray = class {
  lift(value) {
    const buffer = RustBuffer.fromUint8Array(value);
    return this.read(buffer);
  }
  lower(value, alloc) {
    const view = alloc(this.allocationSize(value));
    const buffer = RustBuffer.fromUint8Array(view);
    this.write(value, buffer);
    return view;
  }
};
var FfiConverterNumber = class extends FfiConverterPrimitive {
  reader;
  writer;
  byteSize;
  // These fields should be private, but Typescript doesn't allow
  // that because of the way they are exposed.
  constructor(reader, writer, byteSize) {
    super();
    this.reader = reader;
    this.writer = writer;
    this.byteSize = byteSize;
  }
  read(from) {
    return from.readWithView(this.byteSize, this.reader);
  }
  write(value, into) {
    return into.writeWithView(this.byteSize, (view) => this.writer(view, value));
  }
  allocationSize(value) {
    return this.byteSize;
  }
};
var littleEndian = false;
var FfiConverterInt8 = new FfiConverterNumber((view) => view.getInt8(0), (view, value) => view.setInt8(0, value), Int8Array.BYTES_PER_ELEMENT);
var FfiConverterInt16 = new FfiConverterNumber((view) => view.getInt16(0, littleEndian), (view, value) => view.setInt16(0, value, littleEndian), Int16Array.BYTES_PER_ELEMENT);
var FfiConverterInt32 = new FfiConverterNumber((view) => view.getInt32(0, littleEndian), (view, value) => view.setInt32(0, value, littleEndian), Int32Array.BYTES_PER_ELEMENT);
var FfiConverterInt64 = new FfiConverterNumber((view) => view.getBigInt64(0, littleEndian), (view, value) => view.setBigInt64(0, value, littleEndian), BigInt64Array.BYTES_PER_ELEMENT);
var FfiConverterFloat32 = new FfiConverterNumber((view) => view.getFloat32(0, littleEndian), (view, value) => view.setFloat32(0, value, littleEndian), Float32Array.BYTES_PER_ELEMENT);
var FfiConverterFloat64 = new FfiConverterNumber((view) => view.getFloat64(0, littleEndian), (view, value) => view.setFloat64(0, value, littleEndian), Float64Array.BYTES_PER_ELEMENT);
var FfiConverterUInt8 = new FfiConverterNumber((view) => view.getUint8(0), (view, value) => view.setUint8(0, value), Uint8Array.BYTES_PER_ELEMENT);
var FfiConverterUInt16 = new FfiConverterNumber((view) => view.getUint16(0, littleEndian), (view, value) => view.setUint16(0, value, littleEndian), Uint16Array.BYTES_PER_ELEMENT);
var FfiConverterUInt32 = new FfiConverterNumber((view) => view.getUint32(0, littleEndian), (view, value) => view.setUint32(0, value, littleEndian), Uint32Array.BYTES_PER_ELEMENT);
var FfiConverterUInt64 = new FfiConverterNumber((view) => view.getBigUint64(0, littleEndian), (view, value) => view.setBigUint64(0, value, littleEndian), BigUint64Array.BYTES_PER_ELEMENT);
var FfiConverterBool = (() => {
  const byteConverter = FfiConverterInt8;
  class FfiConverterBool2 {
    lift(value) {
      return !!value;
    }
    lower(value, _alloc) {
      return value ? 1 : 0;
    }
    read(from) {
      return this.lift(byteConverter.read(from));
    }
    write(value, into) {
      byteConverter.write(value ? 1 : 0, into);
    }
    allocationSize(value) {
      return byteConverter.allocationSize(0);
    }
  }
  return new FfiConverterBool2();
})();
var FfiConverterDuration = (() => {
  const secondsConverter = FfiConverterUInt64;
  const nanosConverter = FfiConverterUInt32;
  const msPerSecBigInt = BigInt("1000");
  const nanosPerMs = 1e6;
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      const secsBigInt = secondsConverter.read(from);
      const nanos = nanosConverter.read(from);
      const ms = Number(secsBigInt * msPerSecBigInt);
      if (ms === Number.POSITIVE_INFINITY || ms === Number.NEGATIVE_INFINITY) {
        throw new UniffiInternalError.NumberOverflow();
      }
      return ms + nanos / nanosPerMs;
    }
    write(value, into) {
      const ms = value.valueOf();
      const secsBigInt = BigInt(Math.trunc(ms)) / msPerSecBigInt;
      const remainingNanos = ms % 1e3 * nanosPerMs;
      secondsConverter.write(secsBigInt, into);
      nanosConverter.write(remainingNanos, into);
    }
    allocationSize(_value) {
      return secondsConverter.allocationSize(msPerSecBigInt) + nanosConverter.allocationSize(0);
    }
  }
  return new FFIConverter();
})();
var FfiConverterTimestamp = (() => {
  const secondsConverter = FfiConverterInt64;
  const nanosConverter = FfiConverterUInt32;
  const msPerSecBigInt = BigInt("1000");
  const nanosPerMs = 1e6;
  const msPerSec = 1e3;
  const maxMsFromEpoch = 864e13;
  function safeDate(ms) {
    if (Math.abs(ms) > 864e13) {
      throw new UniffiInternalError.DateTimeOverflow();
    }
    return new Date(ms);
  }
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      const secsBigInt = secondsConverter.read(from);
      const nanos = nanosConverter.read(from);
      const ms = Number(secsBigInt * msPerSecBigInt);
      if (ms >= 0) {
        return safeDate(ms + nanos / nanosPerMs);
      } else {
        return safeDate(ms - nanos / nanosPerMs);
      }
    }
    write(value, into) {
      const ms = value.valueOf();
      const secsBigInt = BigInt(Math.trunc(ms / msPerSec));
      const remainingNanos = Math.abs(ms % msPerSec * nanosPerMs);
      secondsConverter.write(secsBigInt, into);
      nanosConverter.write(remainingNanos, into);
    }
    allocationSize(_value) {
      return secondsConverter.allocationSize(msPerSecBigInt) + nanosConverter.allocationSize(0);
    }
  }
  return new FFIConverter();
})();
var FfiConverterOptional = class _FfiConverterOptional extends AbstractFfiConverterByteArray {
  itemConverter;
  static flagConverter = FfiConverterBool;
  constructor(itemConverter) {
    super();
    this.itemConverter = itemConverter;
  }
  read(from) {
    const flag = _FfiConverterOptional.flagConverter.read(from);
    return flag ? this.itemConverter.read(from) : void 0;
  }
  write(value, into) {
    if (value !== void 0) {
      _FfiConverterOptional.flagConverter.write(true, into);
      this.itemConverter.write(value, into);
    } else {
      _FfiConverterOptional.flagConverter.write(false, into);
    }
  }
  allocationSize(value) {
    let size = _FfiConverterOptional.flagConverter.allocationSize(true);
    if (value !== void 0) {
      size += this.itemConverter.allocationSize(value);
    }
    return size;
  }
};
var FfiConverterArray = class _FfiConverterArray extends AbstractFfiConverterByteArray {
  itemConverter;
  static sizeConverter = FfiConverterInt32;
  constructor(itemConverter) {
    super();
    this.itemConverter = itemConverter;
  }
  read(from) {
    const size = _FfiConverterArray.sizeConverter.read(from);
    const array = new Array(size);
    for (let i = 0; i < size; i++) {
      array[i] = this.itemConverter.read(from);
    }
    return array;
  }
  write(array, into) {
    _FfiConverterArray.sizeConverter.write(array.length, into);
    for (const item of array) {
      this.itemConverter.write(item, into);
    }
  }
  allocationSize(array) {
    let size = _FfiConverterArray.sizeConverter.allocationSize(array.length);
    for (const item of array) {
      size += this.itemConverter.allocationSize(item);
    }
    return size;
  }
};
var FfiConverterArrayBuffer = (() => {
  const lengthConverter = FfiConverterInt32;
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      const length = lengthConverter.read(from);
      return from.readArrayBuffer(length);
    }
    write(value, into) {
      const length = value.byteLength;
      lengthConverter.write(length, into);
      into.writeByteArray(new Uint8Array(value));
    }
    allocationSize(value) {
      return lengthConverter.allocationSize(0) + value.byteLength;
    }
  }
  return new FFIConverter();
})();
var FfiConverterUint8Array = (() => {
  const lengthConverter = FfiConverterInt32;
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      const length = lengthConverter.read(from);
      return new Uint8Array(from.readArrayBuffer(length));
    }
    write(value, into) {
      const length = value.byteLength;
      lengthConverter.write(length, into);
      into.writeByteArray(value);
    }
    allocationSize(value) {
      return lengthConverter.allocationSize(0) + value.byteLength;
    }
  }
  return new FFIConverter();
})();
function uniffiCreateFfiConverterString(converter) {
  const lengthConverter = FfiConverterInt32;
  class FFIConverter {
    lift(value) {
      return converter.bytesToString(value);
    }
    lower(value, _alloc) {
      return converter.stringToBytes(value);
    }
    read(from) {
      const length = lengthConverter.read(from);
      if (converter.readStringFromBuffer) {
        const offset = from.advanceReadOffset(length);
        return converter.readStringFromBuffer(from, offset, length);
      }
      const bytes = from.readByteArray(length);
      return converter.bytesToString(bytes);
    }
    write(value, into) {
      if (converter.writeStringIntoBuffer) {
        const lengthOffset = into.advanceWriteOffset(4);
        const dataOffset = lengthOffset + 4;
        const bytesWritten = converter.writeStringIntoBuffer(value, into, dataOffset);
        new DataView(into.arrayBuffer, lengthOffset, 4).setInt32(0, bytesWritten, false);
        into.setWriteOffset(dataOffset + bytesWritten);
        return;
      }
      const bytes = converter.stringToBytes(value);
      const numBytes = bytes.byteLength;
      lengthConverter.write(numBytes, into);
      into.writeByteArray(bytes);
    }
    allocationSize(value) {
      return lengthConverter.allocationSize(0) + converter.stringByteLength(value);
    }
  }
  return new FFIConverter();
}

// node_modules/.pnpm/@ubjs+core@0.31.0-3/node_modules/@ubjs/core/dist/esm/callbacks.js
function uniffiTraitInterfaceCall(makeCall, handleSuccess, handleError, lowerString, alloc) {
  try {
    handleSuccess(makeCall());
  } catch (e) {
    handleError(CALL_UNEXPECTED_ERROR, lowerString(e.toString(), alloc));
  }
}
function uniffiTraitInterfaceCallWithError(makeCall, handleSuccess, handleError, isErrorType, lowerError, lowerString, alloc) {
  try {
    handleSuccess(makeCall());
  } catch (e) {
    if (isErrorType(e)) {
      handleError(CALL_ERROR, lowerError(e, alloc));
    } else {
      handleError(CALL_UNEXPECTED_ERROR, lowerString(e.toString(), alloc));
    }
  }
}

// node_modules/.pnpm/@ubjs+core@0.31.0-3/node_modules/@ubjs/core/dist/esm/enums.js
var UniffiEnum = class {
  constructor(...args) {
  }
};

// node_modules/.pnpm/@ubjs+core@0.31.0-3/node_modules/@ubjs/core/dist/esm/objects.js
var UniffiAbstractObject = class {
  /**
   * A convenience method to use this object, then destroy it after its use.
   * @param block
   * @returns
   */
  uniffiUse(block) {
    const v = block(this);
    this.uniffiDestroy();
    return v;
  }
};
var pointerConverter = FfiConverterUInt64;
var dummyPointer = BigInt("0");
var FfiConverterObject = class {
  factory;
  constructor(factory) {
    this.factory = factory;
  }
  lift(value) {
    return this.factory.create(value);
  }
  lower(value, _alloc) {
    return this.lowerHandle(value);
  }
  read(from) {
    return this.lift(pointerConverter.read(from));
  }
  write(value, into) {
    pointerConverter.write(this.lowerHandle(value), into);
  }
  lowerHandle(value) {
    if (this.factory.isConcreteType(value)) {
      return this.factory.clonePointer(value);
    } else {
      throw new Error("Cannot lower this object to a pointer");
    }
  }
  allocationSize(value) {
    return pointerConverter.allocationSize(dummyPointer);
  }
};
var FfiConverterObjectWithCallbacks = class extends FfiConverterObject {
  handleMap;
  constructor(factory, handleMap = new UniffiHandleMap()) {
    super(factory);
    this.handleMap = handleMap;
  }
  lower(value, alloc) {
    if (this.factory.isConcreteType(value)) {
      return super.lower(value, alloc);
    }
    return this.handleMap.insert(value);
  }
  lift(value) {
    if (this.handleMap.has(value)) {
      return this.handleMap.get(value);
    } else {
      return super.lift(value);
    }
  }
  drop(handle) {
    return this.handleMap.remove(handle);
  }
  /**
   * Called by Rust's `CallbackInterfaceClone` vtable entry when it clones an
   * Arc holding a foreign-implemented object. Returns a new handle pointing to
   * the same JS object; removing either handle does not affect the other.
   */
  clone(handle) {
    return this.handleMap.clone(handle);
  }
};

// node_modules/.pnpm/@ubjs+core@0.31.0-3/node_modules/@ubjs/core/dist/esm/records.js
var uniffiCreateRecord = (defaults) => {
  return (partial) => Object.freeze({ ...defaults(), ...partial });
};

// node_modules/.pnpm/@ubjs+core@0.31.0-3/node_modules/@ubjs/core/dist/esm/result.js
var UniffiResult = {
  ready() {
    return { code: 0 };
  },
  writeError(result, code, buf) {
    const status = result;
    status.code = code;
    status.errorBuf = buf;
    return status;
  },
  writeSuccess(result, obj) {
    const refHolder = result;
    refHolder.pointee = obj;
    return refHolder;
  },
  success(pointee) {
    return { pointee };
  }
};

// node_modules/.pnpm/@trycua+cua-driver@0.28.2/node_modules/@trycua/cua-driver/dist/native/cua_driver_contract-ffi.js
var { UniffiNativeModule: UniffiNativeModule3, FfiType: FfiType3, resolveLibPath: resolveLibPath3 } = node_runtime_default;
var DEFINITIONS2 = {
  symbols: {
    rustbuffer_alloc: "ffi_cua_driver_contract_rustbuffer_alloc",
    rustbuffer_free: "ffi_cua_driver_contract_rustbuffer_free",
    rustbuffer_from_bytes: "ffi_cua_driver_contract_rustbuffer_from_bytes"
  },
  functions: {
    "ffi_cua_driver_contract_rust_future_poll_u8": {
      args: [FfiType3.Handle, FfiType3.Callback("RustFutureContinuationCallback"), FfiType3.Handle],
      ret: FfiType3.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_contract_rust_future_cancel_u8": {
      args: [FfiType3.Handle],
      ret: FfiType3.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_contract_rust_future_complete_u8": {
      args: [FfiType3.Handle],
      ret: FfiType3.UInt8,
      hasRustCallStatus: true
    },
    "ffi_cua_driver_contract_rust_future_free_u8": {
      args: [FfiType3.Handle],
      ret: FfiType3.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_contract_rust_future_poll_i8": {
      args: [FfiType3.Handle, FfiType3.Callback("RustFutureContinuationCallback"), FfiType3.Handle],
      ret: FfiType3.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_contract_rust_future_cancel_i8": {
      args: [FfiType3.Handle],
      ret: FfiType3.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_contract_rust_future_complete_i8": {
      args: [FfiType3.Handle],
      ret: FfiType3.Int8,
      hasRustCallStatus: true
    },
    "ffi_cua_driver_contract_rust_future_free_i8": {
      args: [FfiType3.Handle],
      ret: FfiType3.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_contract_rust_future_poll_u16": {
      args: [FfiType3.Handle, FfiType3.Callback("RustFutureContinuationCallback"), FfiType3.Handle],
      ret: FfiType3.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_contract_rust_future_cancel_u16": {
      args: [FfiType3.Handle],
      ret: FfiType3.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_contract_rust_future_complete_u16": {
      args: [FfiType3.Handle],
      ret: FfiType3.UInt16,
      hasRustCallStatus: true
    },
    "ffi_cua_driver_contract_rust_future_free_u16": {
      args: [FfiType3.Handle],
      ret: FfiType3.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_contract_rust_future_poll_i16": {
      args: [FfiType3.Handle, FfiType3.Callback("RustFutureContinuationCallback"), FfiType3.Handle],
      ret: FfiType3.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_contract_rust_future_cancel_i16": {
      args: [FfiType3.Handle],
      ret: FfiType3.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_contract_rust_future_complete_i16": {
      args: [FfiType3.Handle],
      ret: FfiType3.Int16,
      hasRustCallStatus: true
    },
    "ffi_cua_driver_contract_rust_future_free_i16": {
      args: [FfiType3.Handle],
      ret: FfiType3.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_contract_rust_future_poll_u32": {
      args: [FfiType3.Handle, FfiType3.Callback("RustFutureContinuationCallback"), FfiType3.Handle],
      ret: FfiType3.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_contract_rust_future_cancel_u32": {
      args: [FfiType3.Handle],
      ret: FfiType3.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_contract_rust_future_complete_u32": {
      args: [FfiType3.Handle],
      ret: FfiType3.UInt32,
      hasRustCallStatus: true
    },
    "ffi_cua_driver_contract_rust_future_free_u32": {
      args: [FfiType3.Handle],
      ret: FfiType3.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_contract_rust_future_poll_i32": {
      args: [FfiType3.Handle, FfiType3.Callback("RustFutureContinuationCallback"), FfiType3.Handle],
      ret: FfiType3.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_contract_rust_future_cancel_i32": {
      args: [FfiType3.Handle],
      ret: FfiType3.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_contract_rust_future_complete_i32": {
      args: [FfiType3.Handle],
      ret: FfiType3.Int32,
      hasRustCallStatus: true
    },
    "ffi_cua_driver_contract_rust_future_free_i32": {
      args: [FfiType3.Handle],
      ret: FfiType3.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_contract_rust_future_poll_u64": {
      args: [FfiType3.Handle, FfiType3.Callback("RustFutureContinuationCallback"), FfiType3.Handle],
      ret: FfiType3.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_contract_rust_future_cancel_u64": {
      args: [FfiType3.Handle],
      ret: FfiType3.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_contract_rust_future_complete_u64": {
      args: [FfiType3.Handle],
      ret: FfiType3.Handle,
      hasRustCallStatus: true
    },
    "ffi_cua_driver_contract_rust_future_free_u64": {
      args: [FfiType3.Handle],
      ret: FfiType3.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_contract_rust_future_poll_i64": {
      args: [FfiType3.Handle, FfiType3.Callback("RustFutureContinuationCallback"), FfiType3.Handle],
      ret: FfiType3.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_contract_rust_future_cancel_i64": {
      args: [FfiType3.Handle],
      ret: FfiType3.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_contract_rust_future_complete_i64": {
      args: [FfiType3.Handle],
      ret: FfiType3.Int64,
      hasRustCallStatus: true
    },
    "ffi_cua_driver_contract_rust_future_free_i64": {
      args: [FfiType3.Handle],
      ret: FfiType3.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_contract_rust_future_poll_f32": {
      args: [FfiType3.Handle, FfiType3.Callback("RustFutureContinuationCallback"), FfiType3.Handle],
      ret: FfiType3.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_contract_rust_future_cancel_f32": {
      args: [FfiType3.Handle],
      ret: FfiType3.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_contract_rust_future_complete_f32": {
      args: [FfiType3.Handle],
      ret: FfiType3.Float32,
      hasRustCallStatus: true
    },
    "ffi_cua_driver_contract_rust_future_free_f32": {
      args: [FfiType3.Handle],
      ret: FfiType3.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_contract_rust_future_poll_f64": {
      args: [FfiType3.Handle, FfiType3.Callback("RustFutureContinuationCallback"), FfiType3.Handle],
      ret: FfiType3.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_contract_rust_future_cancel_f64": {
      args: [FfiType3.Handle],
      ret: FfiType3.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_contract_rust_future_complete_f64": {
      args: [FfiType3.Handle],
      ret: FfiType3.Float64,
      hasRustCallStatus: true
    },
    "ffi_cua_driver_contract_rust_future_free_f64": {
      args: [FfiType3.Handle],
      ret: FfiType3.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_contract_rust_future_poll_rust_buffer": {
      args: [FfiType3.Handle, FfiType3.Callback("RustFutureContinuationCallback"), FfiType3.Handle],
      ret: FfiType3.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_contract_rust_future_cancel_rust_buffer": {
      args: [FfiType3.Handle],
      ret: FfiType3.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_contract_rust_future_complete_rust_buffer": {
      args: [FfiType3.Handle],
      ret: FfiType3.RustBuffer,
      hasRustCallStatus: true
    },
    "ffi_cua_driver_contract_rust_future_free_rust_buffer": {
      args: [FfiType3.Handle],
      ret: FfiType3.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_contract_rust_future_poll_void": {
      args: [FfiType3.Handle, FfiType3.Callback("RustFutureContinuationCallback"), FfiType3.Handle],
      ret: FfiType3.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_contract_rust_future_cancel_void": {
      args: [FfiType3.Handle],
      ret: FfiType3.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_contract_rust_future_complete_void": {
      args: [FfiType3.Handle],
      ret: FfiType3.Void,
      hasRustCallStatus: true
    },
    "ffi_cua_driver_contract_rust_future_free_void": {
      args: [FfiType3.Handle],
      ret: FfiType3.Void,
      hasRustCallStatus: false
    },
    "ffi_cua_driver_contract_uniffi_contract_version": {
      args: [],
      ret: FfiType3.UInt32,
      hasRustCallStatus: false
    }
  },
  callbacks: {
    "RustFutureContinuationCallback": {
      args: [FfiType3.Handle, FfiType3.Int8],
      ret: FfiType3.Void,
      hasRustCallStatus: false
    },
    "ForeignFutureDroppedCallback": {
      args: [FfiType3.Handle],
      ret: FfiType3.Void,
      hasRustCallStatus: false
    }
  },
  structs: {
    "ForeignFutureDroppedCallbackStruct": [
      { name: "handle", type: FfiType3.Handle },
      { name: "free", type: FfiType3.Callback("ForeignFutureDroppedCallback") }
    ]
  }
};
var _nativeModule2;
var getter2 = () => {
  if (!_nativeModule2) {
    const libPath = resolveLibPath3({
      crateName: "cua_driver_sdk",
      callerUrl: import.meta.url,
      npmPackageBase: "@trycua/cua-driver-",
      tripleStyle: "node"
    });
    const mod_ = UniffiNativeModule3.open(libPath);
    _nativeModule2 = mod_.register(DEFINITIONS2);
  }
  return _nativeModule2;
};
var cua_driver_contract_ffi_default = getter2;

// node_modules/.pnpm/@trycua+cua-driver@0.28.2/node_modules/@trycua/cua-driver/dist/native/cua_driver_contract.js
var uniffiCaller = new UniffiRustCaller(() => ({ code: 0 }));
var uniffiIsDebug = (
  // @ts-ignore -- The process global might not be defined
  typeof process !== "object" || // @ts-ignore -- The process global might not be defined
  process?.env?.NODE_ENV !== "production" || false
);
var ActionDeliveryMode;
(function(ActionDeliveryMode2) {
  ActionDeliveryMode2[ActionDeliveryMode2["Background"] = 0] = "Background";
  ActionDeliveryMode2[ActionDeliveryMode2["Foreground"] = 1] = "Foreground";
  ActionDeliveryMode2[ActionDeliveryMode2["NotApplicable"] = 2] = "NotApplicable";
  ActionDeliveryMode2[ActionDeliveryMode2["Unknown"] = 3] = "Unknown";
})(ActionDeliveryMode || (ActionDeliveryMode = {}));
var FfiConverterTypeActionDeliveryMode = (() => {
  const ordinalConverter = FfiConverterInt32;
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      switch (ordinalConverter.read(from)) {
        case 1:
          return ActionDeliveryMode.Background;
        case 2:
          return ActionDeliveryMode.Foreground;
        case 3:
          return ActionDeliveryMode.NotApplicable;
        case 4:
          return ActionDeliveryMode.Unknown;
        default:
          throw new UniffiInternalError.UnexpectedEnumCase();
      }
    }
    write(value, into) {
      switch (value) {
        case ActionDeliveryMode.Background:
          return ordinalConverter.write(1, into);
        case ActionDeliveryMode.Foreground:
          return ordinalConverter.write(2, into);
        case ActionDeliveryMode.NotApplicable:
          return ordinalConverter.write(3, into);
        case ActionDeliveryMode.Unknown:
          return ordinalConverter.write(4, into);
      }
    }
    allocationSize(value) {
      return ordinalConverter.allocationSize(0);
    }
  }
  return new FFIConverter();
})();
var ActionDelivery = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeActionDelivery = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        mode: FfiConverterTypeActionDeliveryMode.read(from),
        deliveredCount: FfiConverterOptionalUInt32.read(from)
      };
    }
    write(value, into) {
      FfiConverterTypeActionDeliveryMode.write(value.mode, into);
      FfiConverterOptionalUInt32.write(value.deliveredCount, into);
    }
    allocationSize(value) {
      return FfiConverterTypeActionDeliveryMode.allocationSize(value.mode) + FfiConverterOptionalUInt32.allocationSize(value.deliveredCount);
    }
  }
  ;
  return new FFIConverter();
})();
var ActionEscalationTarget;
(function(ActionEscalationTarget2) {
  ActionEscalationTarget2[ActionEscalationTarget2["Pixel"] = 0] = "Pixel";
  ActionEscalationTarget2[ActionEscalationTarget2["Foreground"] = 1] = "Foreground";
  ActionEscalationTarget2[ActionEscalationTarget2["Page"] = 2] = "Page";
  ActionEscalationTarget2[ActionEscalationTarget2["Session"] = 3] = "Session";
})(ActionEscalationTarget || (ActionEscalationTarget = {}));
var FfiConverterTypeActionEscalationTarget = (() => {
  const ordinalConverter = FfiConverterInt32;
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      switch (ordinalConverter.read(from)) {
        case 1:
          return ActionEscalationTarget.Pixel;
        case 2:
          return ActionEscalationTarget.Foreground;
        case 3:
          return ActionEscalationTarget.Page;
        case 4:
          return ActionEscalationTarget.Session;
        default:
          throw new UniffiInternalError.UnexpectedEnumCase();
      }
    }
    write(value, into) {
      switch (value) {
        case ActionEscalationTarget.Pixel:
          return ordinalConverter.write(1, into);
        case ActionEscalationTarget.Foreground:
          return ordinalConverter.write(2, into);
        case ActionEscalationTarget.Page:
          return ordinalConverter.write(3, into);
        case ActionEscalationTarget.Session:
          return ordinalConverter.write(4, into);
      }
    }
    allocationSize(value) {
      return ordinalConverter.allocationSize(0);
    }
  }
  return new FFIConverter();
})();
var ActionEscalationReason;
(function(ActionEscalationReason2) {
  ActionEscalationReason2[ActionEscalationReason2["RouteUnavailable"] = 0] = "RouteUnavailable";
  ActionEscalationReason2[ActionEscalationReason2["DeliveryFailed"] = 1] = "DeliveryFailed";
  ActionEscalationReason2[ActionEscalationReason2["EffectUnconfirmed"] = 2] = "EffectUnconfirmed";
  ActionEscalationReason2[ActionEscalationReason2["SuspectedNoop"] = 3] = "SuspectedNoop";
  ActionEscalationReason2[ActionEscalationReason2["PermissionRequired"] = 4] = "PermissionRequired";
})(ActionEscalationReason || (ActionEscalationReason = {}));
var FfiConverterTypeActionEscalationReason = (() => {
  const ordinalConverter = FfiConverterInt32;
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      switch (ordinalConverter.read(from)) {
        case 1:
          return ActionEscalationReason.RouteUnavailable;
        case 2:
          return ActionEscalationReason.DeliveryFailed;
        case 3:
          return ActionEscalationReason.EffectUnconfirmed;
        case 4:
          return ActionEscalationReason.SuspectedNoop;
        case 5:
          return ActionEscalationReason.PermissionRequired;
        default:
          throw new UniffiInternalError.UnexpectedEnumCase();
      }
    }
    write(value, into) {
      switch (value) {
        case ActionEscalationReason.RouteUnavailable:
          return ordinalConverter.write(1, into);
        case ActionEscalationReason.DeliveryFailed:
          return ordinalConverter.write(2, into);
        case ActionEscalationReason.EffectUnconfirmed:
          return ordinalConverter.write(3, into);
        case ActionEscalationReason.SuspectedNoop:
          return ordinalConverter.write(4, into);
        case ActionEscalationReason.PermissionRequired:
          return ordinalConverter.write(5, into);
      }
    }
    allocationSize(value) {
      return ordinalConverter.allocationSize(0);
    }
  }
  return new FFIConverter();
})();
var ActionEscalation = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeActionEscalation = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        target: FfiConverterTypeActionEscalationTarget.read(from),
        reason: FfiConverterTypeActionEscalationReason.read(from)
      };
    }
    write(value, into) {
      FfiConverterTypeActionEscalationTarget.write(value.target, into);
      FfiConverterTypeActionEscalationReason.write(value.reason, into);
    }
    allocationSize(value) {
      return FfiConverterTypeActionEscalationTarget.allocationSize(value.target) + FfiConverterTypeActionEscalationReason.allocationSize(value.reason);
    }
  }
  ;
  return new FFIConverter();
})();
var ActionEvidenceKind;
(function(ActionEvidenceKind2) {
  ActionEvidenceKind2[ActionEvidenceKind2["ValueReadback"] = 0] = "ValueReadback";
  ActionEvidenceKind2[ActionEvidenceKind2["WindowChange"] = 1] = "WindowChange";
})(ActionEvidenceKind || (ActionEvidenceKind = {}));
var FfiConverterTypeActionEvidenceKind = (() => {
  const ordinalConverter = FfiConverterInt32;
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      switch (ordinalConverter.read(from)) {
        case 1:
          return ActionEvidenceKind.ValueReadback;
        case 2:
          return ActionEvidenceKind.WindowChange;
        default:
          throw new UniffiInternalError.UnexpectedEnumCase();
      }
    }
    write(value, into) {
      switch (value) {
        case ActionEvidenceKind.ValueReadback:
          return ordinalConverter.write(1, into);
        case ActionEvidenceKind.WindowChange:
          return ordinalConverter.write(2, into);
      }
    }
    allocationSize(value) {
      return ordinalConverter.allocationSize(0);
    }
  }
  return new FFIConverter();
})();
var ActionEvidence = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeActionEvidence = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        kind: FfiConverterTypeActionEvidenceKind.read(from)
      };
    }
    write(value, into) {
      FfiConverterTypeActionEvidenceKind.write(value.kind, into);
    }
    allocationSize(value) {
      return FfiConverterTypeActionEvidenceKind.allocationSize(value.kind);
    }
  }
  ;
  return new FFIConverter();
})();
var ActionEffect;
(function(ActionEffect2) {
  ActionEffect2[ActionEffect2["Confirmed"] = 0] = "Confirmed";
  ActionEffect2[ActionEffect2["Partial"] = 1] = "Partial";
  ActionEffect2[ActionEffect2["Unverifiable"] = 2] = "Unverifiable";
  ActionEffect2[ActionEffect2["SuspectedNoop"] = 3] = "SuspectedNoop";
  ActionEffect2[ActionEffect2["Refused"] = 4] = "Refused";
})(ActionEffect || (ActionEffect = {}));
var FfiConverterTypeActionEffect = (() => {
  const ordinalConverter = FfiConverterInt32;
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      switch (ordinalConverter.read(from)) {
        case 1:
          return ActionEffect.Confirmed;
        case 2:
          return ActionEffect.Partial;
        case 3:
          return ActionEffect.Unverifiable;
        case 4:
          return ActionEffect.SuspectedNoop;
        case 5:
          return ActionEffect.Refused;
        default:
          throw new UniffiInternalError.UnexpectedEnumCase();
      }
    }
    write(value, into) {
      switch (value) {
        case ActionEffect.Confirmed:
          return ordinalConverter.write(1, into);
        case ActionEffect.Partial:
          return ordinalConverter.write(2, into);
        case ActionEffect.Unverifiable:
          return ordinalConverter.write(3, into);
        case ActionEffect.SuspectedNoop:
          return ordinalConverter.write(4, into);
        case ActionEffect.Refused:
          return ordinalConverter.write(5, into);
      }
    }
    allocationSize(value) {
      return ordinalConverter.allocationSize(0);
    }
  }
  return new FFIConverter();
})();
var ActionRoute;
(function(ActionRoute2) {
  ActionRoute2[ActionRoute2["Accessibility"] = 0] = "Accessibility";
  ActionRoute2[ActionRoute2["SyntheticEvents"] = 1] = "SyntheticEvents";
  ActionRoute2[ActionRoute2["GlobalInput"] = 2] = "GlobalInput";
  ActionRoute2[ActionRoute2["SystemApi"] = 3] = "SystemApi";
  ActionRoute2[ActionRoute2["Dom"] = 4] = "Dom";
  ActionRoute2[ActionRoute2["TrustedInput"] = 5] = "TrustedInput";
})(ActionRoute || (ActionRoute = {}));
var FfiConverterTypeActionRoute = (() => {
  const ordinalConverter = FfiConverterInt32;
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      switch (ordinalConverter.read(from)) {
        case 1:
          return ActionRoute.Accessibility;
        case 2:
          return ActionRoute.SyntheticEvents;
        case 3:
          return ActionRoute.GlobalInput;
        case 4:
          return ActionRoute.SystemApi;
        case 5:
          return ActionRoute.Dom;
        case 6:
          return ActionRoute.TrustedInput;
        default:
          throw new UniffiInternalError.UnexpectedEnumCase();
      }
    }
    write(value, into) {
      switch (value) {
        case ActionRoute.Accessibility:
          return ordinalConverter.write(1, into);
        case ActionRoute.SyntheticEvents:
          return ordinalConverter.write(2, into);
        case ActionRoute.GlobalInput:
          return ordinalConverter.write(3, into);
        case ActionRoute.SystemApi:
          return ordinalConverter.write(4, into);
        case ActionRoute.Dom:
          return ordinalConverter.write(5, into);
        case ActionRoute.TrustedInput:
          return ordinalConverter.write(6, into);
      }
    }
    allocationSize(value) {
      return ordinalConverter.allocationSize(0);
    }
  }
  return new FFIConverter();
})();
var ActionResult = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeActionResult = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        effect: FfiConverterTypeActionEffect.read(from),
        route: FfiConverterTypeActionRoute.read(from),
        delivery: FfiConverterOptionalTypeActionDelivery.read(from),
        evidence: FfiConverterOptionalSequenceTypeActionEvidence.read(from),
        escalation: FfiConverterOptionalTypeActionEscalation.read(from)
      };
    }
    write(value, into) {
      FfiConverterTypeActionEffect.write(value.effect, into);
      FfiConverterTypeActionRoute.write(value.route, into);
      FfiConverterOptionalTypeActionDelivery.write(value.delivery, into);
      FfiConverterOptionalSequenceTypeActionEvidence.write(value.evidence, into);
      FfiConverterOptionalTypeActionEscalation.write(value.escalation, into);
    }
    allocationSize(value) {
      return FfiConverterTypeActionEffect.allocationSize(value.effect) + FfiConverterTypeActionRoute.allocationSize(value.route) + FfiConverterOptionalTypeActionDelivery.allocationSize(value.delivery) + FfiConverterOptionalSequenceTypeActionEvidence.allocationSize(value.evidence) + FfiConverterOptionalTypeActionEscalation.allocationSize(value.escalation);
    }
  }
  ;
  return new FFIConverter();
})();
var stringConverter = (() => {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  return {
    stringToBytes: (s) => encoder.encode(s),
    bytesToString: (ab) => decoder.decode(ab),
    stringByteLength: (s) => encoder.encode(s).byteLength,
    writeStringIntoBuffer: (s, buf, offset) => {
      const view = new Uint8Array(buf.arrayBuffer, offset, buf.arrayBuffer.byteLength - offset);
      return encoder.encodeInto(s, view).written;
    },
    readStringFromBuffer: (buf, offset, length) => decoder.decode(new Uint8Array(buf.arrayBuffer, offset, length))
  };
})();
var FfiConverterString = uniffiCreateFfiConverterString(stringConverter);
var AppInfo = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeAppInfo = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        pid: FfiConverterUInt32.read(from),
        name: FfiConverterString.read(from),
        running: FfiConverterBool.read(from),
        active: FfiConverterBool.read(from),
        bundleId: FfiConverterOptionalString.read(from),
        launchPath: FfiConverterOptionalString.read(from),
        kind: FfiConverterOptionalString.read(from),
        lastUsed: FfiConverterOptionalString.read(from)
      };
    }
    write(value, into) {
      FfiConverterUInt32.write(value.pid, into);
      FfiConverterString.write(value.name, into);
      FfiConverterBool.write(value.running, into);
      FfiConverterBool.write(value.active, into);
      FfiConverterOptionalString.write(value.bundleId, into);
      FfiConverterOptionalString.write(value.launchPath, into);
      FfiConverterOptionalString.write(value.kind, into);
      FfiConverterOptionalString.write(value.lastUsed, into);
    }
    allocationSize(value) {
      return FfiConverterUInt32.allocationSize(value.pid) + FfiConverterString.allocationSize(value.name) + FfiConverterBool.allocationSize(value.running) + FfiConverterBool.allocationSize(value.active) + FfiConverterOptionalString.allocationSize(value.bundleId) + FfiConverterOptionalString.allocationSize(value.launchPath) + FfiConverterOptionalString.allocationSize(value.kind) + FfiConverterOptionalString.allocationSize(value.lastUsed);
    }
  }
  ;
  return new FFIConverter();
})();
var BoundsExpectation = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeBoundsExpectation = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        x: FfiConverterFloat64.read(from),
        y: FfiConverterFloat64.read(from),
        width: FfiConverterFloat64.read(from),
        height: FfiConverterFloat64.read(from),
        tolerancePx: FfiConverterOptionalFloat64.read(from)
      };
    }
    write(value, into) {
      FfiConverterFloat64.write(value.x, into);
      FfiConverterFloat64.write(value.y, into);
      FfiConverterFloat64.write(value.width, into);
      FfiConverterFloat64.write(value.height, into);
      FfiConverterOptionalFloat64.write(value.tolerancePx, into);
    }
    allocationSize(value) {
      return FfiConverterFloat64.allocationSize(value.x) + FfiConverterFloat64.allocationSize(value.y) + FfiConverterFloat64.allocationSize(value.width) + FfiConverterFloat64.allocationSize(value.height) + FfiConverterOptionalFloat64.allocationSize(value.tolerancePx);
    }
  }
  ;
  return new FFIConverter();
})();
var ActionTarget_Tags;
(function(ActionTarget_Tags2) {
  ActionTarget_Tags2["Window"] = "Window";
  ActionTarget_Tags2["Desktop"] = "Desktop";
})(ActionTarget_Tags || (ActionTarget_Tags = {}));
var ActionTarget = (() => {
  class Window_ extends UniffiEnum {
    /**
     * @private
     * This field is private and should not be used, use `tag` instead.
     */
    [uniffiTypeNameSymbol] = "ActionTarget";
    tag = ActionTarget_Tags.Window;
    inner;
    constructor(inner) {
      super("ActionTarget", "Window");
      this.inner = Object.freeze(inner);
    }
    static new(inner) {
      return new Window_(inner);
    }
    static instanceOf(obj) {
      return obj.tag === ActionTarget_Tags.Window;
    }
  }
  class Desktop_ extends UniffiEnum {
    /**
     * @private
     * This field is private and should not be used, use `tag` instead.
     */
    [uniffiTypeNameSymbol] = "ActionTarget";
    tag = ActionTarget_Tags.Desktop;
    inner;
    constructor(inner) {
      super("ActionTarget", "Desktop");
      this.inner = Object.freeze(inner);
    }
    static new(inner) {
      return new Desktop_(inner);
    }
    static instanceOf(obj) {
      return obj.tag === ActionTarget_Tags.Desktop;
    }
  }
  function instanceOf(obj) {
    return obj[uniffiTypeNameSymbol] === "ActionTarget";
  }
  return Object.freeze({
    instanceOf,
    Window: Window_,
    Desktop: Desktop_
  });
})();
var FfiConverterTypeActionTarget = (() => {
  const ordinalConverter = FfiConverterInt32;
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      switch (ordinalConverter.read(from)) {
        case 1:
          return new ActionTarget.Window({ pid: FfiConverterUInt32.read(from), windowId: FfiConverterUInt64.read(from) });
        case 2:
          return new ActionTarget.Desktop({ displayId: FfiConverterString.read(from) });
        default:
          throw new UniffiInternalError.UnexpectedEnumCase();
      }
    }
    write(value, into) {
      switch (value.tag) {
        case ActionTarget_Tags.Window: {
          ordinalConverter.write(1, into);
          const inner = value.inner;
          FfiConverterUInt32.write(inner.pid, into);
          FfiConverterUInt64.write(inner.windowId, into);
          return;
        }
        case ActionTarget_Tags.Desktop: {
          ordinalConverter.write(2, into);
          const inner = value.inner;
          FfiConverterString.write(inner.displayId, into);
          return;
        }
        default:
          throw new UniffiInternalError.UnexpectedEnumCase();
      }
    }
    allocationSize(value) {
      switch (value.tag) {
        case ActionTarget_Tags.Window: {
          const inner = value.inner;
          let size = ordinalConverter.allocationSize(1);
          size += FfiConverterUInt32.allocationSize(inner.pid);
          size += FfiConverterUInt64.allocationSize(inner.windowId);
          return size;
        }
        case ActionTarget_Tags.Desktop: {
          const inner = value.inner;
          let size = ordinalConverter.allocationSize(2);
          size += FfiConverterString.allocationSize(inner.displayId);
          return size;
        }
        default:
          throw new UniffiInternalError.UnexpectedEnumCase();
      }
    }
  }
  return new FFIConverter();
})();
var ClickPosition_Tags;
(function(ClickPosition_Tags2) {
  ClickPosition_Tags2["Coordinates"] = "Coordinates";
  ClickPosition_Tags2["Element"] = "Element";
})(ClickPosition_Tags || (ClickPosition_Tags = {}));
var ClickPosition = (() => {
  class Coordinates_ extends UniffiEnum {
    /**
     * @private
     * This field is private and should not be used, use `tag` instead.
     */
    [uniffiTypeNameSymbol] = "ClickPosition";
    tag = ClickPosition_Tags.Coordinates;
    inner;
    constructor(inner) {
      super("ClickPosition", "Coordinates");
      this.inner = Object.freeze(inner);
    }
    static new(inner) {
      return new Coordinates_(inner);
    }
    static instanceOf(obj) {
      return obj.tag === ClickPosition_Tags.Coordinates;
    }
  }
  class Element_ extends UniffiEnum {
    /**
     * @private
     * This field is private and should not be used, use `tag` instead.
     */
    [uniffiTypeNameSymbol] = "ClickPosition";
    tag = ClickPosition_Tags.Element;
    inner;
    constructor(inner) {
      super("ClickPosition", "Element");
      this.inner = Object.freeze(inner);
    }
    static new(inner) {
      return new Element_(inner);
    }
    static instanceOf(obj) {
      return obj.tag === ClickPosition_Tags.Element;
    }
  }
  function instanceOf(obj) {
    return obj[uniffiTypeNameSymbol] === "ClickPosition";
  }
  return Object.freeze({
    instanceOf,
    Coordinates: Coordinates_,
    Element: Element_
  });
})();
var FfiConverterTypeClickPosition = (() => {
  const ordinalConverter = FfiConverterInt32;
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      switch (ordinalConverter.read(from)) {
        case 1:
          return new ClickPosition.Coordinates({ x: FfiConverterFloat64.read(from), y: FfiConverterFloat64.read(from) });
        case 2:
          return new ClickPosition.Element({ elementToken: FfiConverterString.read(from) });
        default:
          throw new UniffiInternalError.UnexpectedEnumCase();
      }
    }
    write(value, into) {
      switch (value.tag) {
        case ClickPosition_Tags.Coordinates: {
          ordinalConverter.write(1, into);
          const inner = value.inner;
          FfiConverterFloat64.write(inner.x, into);
          FfiConverterFloat64.write(inner.y, into);
          return;
        }
        case ClickPosition_Tags.Element: {
          ordinalConverter.write(2, into);
          const inner = value.inner;
          FfiConverterString.write(inner.elementToken, into);
          return;
        }
        default:
          throw new UniffiInternalError.UnexpectedEnumCase();
      }
    }
    allocationSize(value) {
      switch (value.tag) {
        case ClickPosition_Tags.Coordinates: {
          const inner = value.inner;
          let size = ordinalConverter.allocationSize(1);
          size += FfiConverterFloat64.allocationSize(inner.x);
          size += FfiConverterFloat64.allocationSize(inner.y);
          return size;
        }
        case ClickPosition_Tags.Element: {
          const inner = value.inner;
          let size = ordinalConverter.allocationSize(2);
          size += FfiConverterString.allocationSize(inner.elementToken);
          return size;
        }
        default:
          throw new UniffiInternalError.UnexpectedEnumCase();
      }
    }
  }
  return new FFIConverter();
})();
var InputDeliveryMode;
(function(InputDeliveryMode2) {
  InputDeliveryMode2[InputDeliveryMode2["Background"] = 0] = "Background";
  InputDeliveryMode2[InputDeliveryMode2["Foreground"] = 1] = "Foreground";
})(InputDeliveryMode || (InputDeliveryMode = {}));
var FfiConverterTypeInputDeliveryMode = (() => {
  const ordinalConverter = FfiConverterInt32;
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      switch (ordinalConverter.read(from)) {
        case 1:
          return InputDeliveryMode.Background;
        case 2:
          return InputDeliveryMode.Foreground;
        default:
          throw new UniffiInternalError.UnexpectedEnumCase();
      }
    }
    write(value, into) {
      switch (value) {
        case InputDeliveryMode.Background:
          return ordinalConverter.write(1, into);
        case InputDeliveryMode.Foreground:
          return ordinalConverter.write(2, into);
      }
    }
    allocationSize(value) {
      return ordinalConverter.allocationSize(0);
    }
  }
  return new FFIConverter();
})();
var ClickButton;
(function(ClickButton2) {
  ClickButton2[ClickButton2["Left"] = 0] = "Left";
  ClickButton2[ClickButton2["Right"] = 1] = "Right";
  ClickButton2[ClickButton2["Middle"] = 2] = "Middle";
})(ClickButton || (ClickButton = {}));
var FfiConverterTypeClickButton = (() => {
  const ordinalConverter = FfiConverterInt32;
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      switch (ordinalConverter.read(from)) {
        case 1:
          return ClickButton.Left;
        case 2:
          return ClickButton.Right;
        case 3:
          return ClickButton.Middle;
        default:
          throw new UniffiInternalError.UnexpectedEnumCase();
      }
    }
    write(value, into) {
      switch (value) {
        case ClickButton.Left:
          return ordinalConverter.write(1, into);
        case ClickButton.Right:
          return ordinalConverter.write(2, into);
        case ClickButton.Middle:
          return ordinalConverter.write(3, into);
      }
    }
    allocationSize(value) {
      return ordinalConverter.allocationSize(0);
    }
  }
  return new FFIConverter();
})();
var ClickInput = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeClickInput = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        target: FfiConverterTypeActionTarget.read(from),
        position: FfiConverterTypeClickPosition.read(from),
        deliveryMode: FfiConverterTypeInputDeliveryMode.read(from),
        session: FfiConverterOptionalString.read(from),
        button: FfiConverterOptionalTypeClickButton.read(from),
        count: FfiConverterOptionalUInt32.read(from)
      };
    }
    write(value, into) {
      FfiConverterTypeActionTarget.write(value.target, into);
      FfiConverterTypeClickPosition.write(value.position, into);
      FfiConverterTypeInputDeliveryMode.write(value.deliveryMode, into);
      FfiConverterOptionalString.write(value.session, into);
      FfiConverterOptionalTypeClickButton.write(value.button, into);
      FfiConverterOptionalUInt32.write(value.count, into);
    }
    allocationSize(value) {
      return FfiConverterTypeActionTarget.allocationSize(value.target) + FfiConverterTypeClickPosition.allocationSize(value.position) + FfiConverterTypeInputDeliveryMode.allocationSize(value.deliveryMode) + FfiConverterOptionalString.allocationSize(value.session) + FfiConverterOptionalTypeClickButton.allocationSize(value.button) + FfiConverterOptionalUInt32.allocationSize(value.count);
    }
  }
  ;
  return new FFIConverter();
})();
var ClipboardReadInput = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeClipboardReadInput = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        includeText: FfiConverterBool.read(from),
        session: FfiConverterOptionalString.read(from)
      };
    }
    write(value, into) {
      FfiConverterBool.write(value.includeText, into);
      FfiConverterOptionalString.write(value.session, into);
    }
    allocationSize(value) {
      return FfiConverterBool.allocationSize(value.includeText) + FfiConverterOptionalString.allocationSize(value.session);
    }
  }
  ;
  return new FFIConverter();
})();
var ClipboardReadOutput = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeClipboardReadOutput = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        supported: FfiConverterBool.read(from),
        types: FfiConverterSequenceString.read(from),
        text: FfiConverterOptionalString.read(from),
        privacySensitive: FfiConverterBool.read(from),
        contentRedactedFromTelemetry: FfiConverterBool.read(from)
      };
    }
    write(value, into) {
      FfiConverterBool.write(value.supported, into);
      FfiConverterSequenceString.write(value.types, into);
      FfiConverterOptionalString.write(value.text, into);
      FfiConverterBool.write(value.privacySensitive, into);
      FfiConverterBool.write(value.contentRedactedFromTelemetry, into);
    }
    allocationSize(value) {
      return FfiConverterBool.allocationSize(value.supported) + FfiConverterSequenceString.allocationSize(value.types) + FfiConverterOptionalString.allocationSize(value.text) + FfiConverterBool.allocationSize(value.privacySensitive) + FfiConverterBool.allocationSize(value.contentRedactedFromTelemetry);
    }
  }
  ;
  return new FFIConverter();
})();
var ClipboardWriteInput = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeClipboardWriteInput = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        text: FfiConverterOptionalString.read(from),
        imagePath: FfiConverterOptionalString.read(from),
        filePath: FfiConverterOptionalString.read(from),
        session: FfiConverterOptionalString.read(from)
      };
    }
    write(value, into) {
      FfiConverterOptionalString.write(value.text, into);
      FfiConverterOptionalString.write(value.imagePath, into);
      FfiConverterOptionalString.write(value.filePath, into);
      FfiConverterOptionalString.write(value.session, into);
    }
    allocationSize(value) {
      return FfiConverterOptionalString.allocationSize(value.text) + FfiConverterOptionalString.allocationSize(value.imagePath) + FfiConverterOptionalString.allocationSize(value.filePath) + FfiConverterOptionalString.allocationSize(value.session);
    }
  }
  ;
  return new FFIConverter();
})();
var ClipboardWriteOutput = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeClipboardWriteOutput = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        supported: FfiConverterBool.read(from),
        writtenType: FfiConverterString.read(from),
        types: FfiConverterSequenceString.read(from),
        privacySensitive: FfiConverterBool.read(from),
        contentRedactedFromTelemetry: FfiConverterBool.read(from)
      };
    }
    write(value, into) {
      FfiConverterBool.write(value.supported, into);
      FfiConverterString.write(value.writtenType, into);
      FfiConverterSequenceString.write(value.types, into);
      FfiConverterBool.write(value.privacySensitive, into);
      FfiConverterBool.write(value.contentRedactedFromTelemetry, into);
    }
    allocationSize(value) {
      return FfiConverterBool.allocationSize(value.supported) + FfiConverterString.allocationSize(value.writtenType) + FfiConverterSequenceString.allocationSize(value.types) + FfiConverterBool.allocationSize(value.privacySensitive) + FfiConverterBool.allocationSize(value.contentRedactedFromTelemetry);
    }
  }
  ;
  return new FFIConverter();
})();
var CursorMotionOutput = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeCursorMotionOutput = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        startHandle: FfiConverterFloat64.read(from),
        endHandle: FfiConverterFloat64.read(from),
        arcSize: FfiConverterFloat64.read(from),
        arcFlow: FfiConverterFloat64.read(from),
        spring: FfiConverterFloat64.read(from),
        glideDurationMs: FfiConverterFloat64.read(from),
        dwellAfterClickMs: FfiConverterFloat64.read(from),
        idleHideMs: FfiConverterFloat64.read(from),
        turnRadius: FfiConverterFloat64.read(from)
      };
    }
    write(value, into) {
      FfiConverterFloat64.write(value.startHandle, into);
      FfiConverterFloat64.write(value.endHandle, into);
      FfiConverterFloat64.write(value.arcSize, into);
      FfiConverterFloat64.write(value.arcFlow, into);
      FfiConverterFloat64.write(value.spring, into);
      FfiConverterFloat64.write(value.glideDurationMs, into);
      FfiConverterFloat64.write(value.dwellAfterClickMs, into);
      FfiConverterFloat64.write(value.idleHideMs, into);
      FfiConverterFloat64.write(value.turnRadius, into);
    }
    allocationSize(value) {
      return FfiConverterFloat64.allocationSize(value.startHandle) + FfiConverterFloat64.allocationSize(value.endHandle) + FfiConverterFloat64.allocationSize(value.arcSize) + FfiConverterFloat64.allocationSize(value.arcFlow) + FfiConverterFloat64.allocationSize(value.spring) + FfiConverterFloat64.allocationSize(value.glideDurationMs) + FfiConverterFloat64.allocationSize(value.dwellAfterClickMs) + FfiConverterFloat64.allocationSize(value.idleHideMs) + FfiConverterFloat64.allocationSize(value.turnRadius);
    }
  }
  ;
  return new FFIConverter();
})();
var CursorPointOutput = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeCursorPointOutput = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        x: FfiConverterFloat64.read(from),
        y: FfiConverterFloat64.read(from)
      };
    }
    write(value, into) {
      FfiConverterFloat64.write(value.x, into);
      FfiConverterFloat64.write(value.y, into);
    }
    allocationSize(value) {
      return FfiConverterFloat64.allocationSize(value.x) + FfiConverterFloat64.allocationSize(value.y);
    }
  }
  ;
  return new FFIConverter();
})();
var CursorReducedMotion;
(function(CursorReducedMotion2) {
  CursorReducedMotion2[CursorReducedMotion2["Auto"] = 0] = "Auto";
  CursorReducedMotion2[CursorReducedMotion2["On"] = 1] = "On";
  CursorReducedMotion2[CursorReducedMotion2["Off"] = 2] = "Off";
})(CursorReducedMotion || (CursorReducedMotion = {}));
var FfiConverterTypeCursorReducedMotion = (() => {
  const ordinalConverter = FfiConverterInt32;
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      switch (ordinalConverter.read(from)) {
        case 1:
          return CursorReducedMotion.Auto;
        case 2:
          return CursorReducedMotion.On;
        case 3:
          return CursorReducedMotion.Off;
        default:
          throw new UniffiInternalError.UnexpectedEnumCase();
      }
    }
    write(value, into) {
      switch (value) {
        case CursorReducedMotion.Auto:
          return ordinalConverter.write(1, into);
        case CursorReducedMotion.On:
          return ordinalConverter.write(2, into);
        case CursorReducedMotion.Off:
          return ordinalConverter.write(3, into);
      }
    }
    allocationSize(value) {
      return ordinalConverter.allocationSize(0);
    }
  }
  return new FFIConverter();
})();
var CursorThemeOutput = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeCursorThemeOutput = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        id: FfiConverterString.read(from),
        version: FfiConverterString.read(from),
        profile: FfiConverterString.read(from),
        reducedMotion: FfiConverterTypeCursorReducedMotion.read(from),
        fallback: FfiConverterOptionalString.read(from)
      };
    }
    write(value, into) {
      FfiConverterString.write(value.id, into);
      FfiConverterString.write(value.version, into);
      FfiConverterString.write(value.profile, into);
      FfiConverterTypeCursorReducedMotion.write(value.reducedMotion, into);
      FfiConverterOptionalString.write(value.fallback, into);
    }
    allocationSize(value) {
      return FfiConverterString.allocationSize(value.id) + FfiConverterString.allocationSize(value.version) + FfiConverterString.allocationSize(value.profile) + FfiConverterTypeCursorReducedMotion.allocationSize(value.reducedMotion) + FfiConverterOptionalString.allocationSize(value.fallback);
    }
  }
  ;
  return new FFIConverter();
})();
var CursorThemeSelection = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeCursorThemeSelection = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        themeId: FfiConverterString.read(from),
        reducedMotion: FfiConverterTypeCursorReducedMotion.read(from)
      };
    }
    write(value, into) {
      FfiConverterString.write(value.themeId, into);
      FfiConverterTypeCursorReducedMotion.write(value.reducedMotion, into);
    }
    allocationSize(value) {
      return FfiConverterString.allocationSize(value.themeId) + FfiConverterTypeCursorReducedMotion.allocationSize(value.reducedMotion);
    }
  }
  ;
  return new FFIConverter();
})();
var CursorAction;
(function(CursorAction2) {
  CursorAction2[CursorAction2["Idle"] = 0] = "Idle";
  CursorAction2[CursorAction2["Observe"] = 1] = "Observe";
  CursorAction2[CursorAction2["Click"] = 2] = "Click";
  CursorAction2[CursorAction2["Drag"] = 3] = "Drag";
  CursorAction2[CursorAction2["Scroll"] = 4] = "Scroll";
  CursorAction2[CursorAction2["Text"] = 5] = "Text";
  CursorAction2[CursorAction2["Key"] = 6] = "Key";
  CursorAction2[CursorAction2["Navigate"] = 7] = "Navigate";
  CursorAction2[CursorAction2["App"] = 8] = "App";
  CursorAction2[CursorAction2["Transfer"] = 9] = "Transfer";
  CursorAction2[CursorAction2["Record"] = 10] = "Record";
  CursorAction2[CursorAction2["System"] = 11] = "System";
})(CursorAction || (CursorAction = {}));
var FfiConverterTypeCursorAction = (() => {
  const ordinalConverter = FfiConverterInt32;
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      switch (ordinalConverter.read(from)) {
        case 1:
          return CursorAction.Idle;
        case 2:
          return CursorAction.Observe;
        case 3:
          return CursorAction.Click;
        case 4:
          return CursorAction.Drag;
        case 5:
          return CursorAction.Scroll;
        case 6:
          return CursorAction.Text;
        case 7:
          return CursorAction.Key;
        case 8:
          return CursorAction.Navigate;
        case 9:
          return CursorAction.App;
        case 10:
          return CursorAction.Transfer;
        case 11:
          return CursorAction.Record;
        case 12:
          return CursorAction.System;
        default:
          throw new UniffiInternalError.UnexpectedEnumCase();
      }
    }
    write(value, into) {
      switch (value) {
        case CursorAction.Idle:
          return ordinalConverter.write(1, into);
        case CursorAction.Observe:
          return ordinalConverter.write(2, into);
        case CursorAction.Click:
          return ordinalConverter.write(3, into);
        case CursorAction.Drag:
          return ordinalConverter.write(4, into);
        case CursorAction.Scroll:
          return ordinalConverter.write(5, into);
        case CursorAction.Text:
          return ordinalConverter.write(6, into);
        case CursorAction.Key:
          return ordinalConverter.write(7, into);
        case CursorAction.Navigate:
          return ordinalConverter.write(8, into);
        case CursorAction.App:
          return ordinalConverter.write(9, into);
        case CursorAction.Transfer:
          return ordinalConverter.write(10, into);
        case CursorAction.Record:
          return ordinalConverter.write(11, into);
        case CursorAction.System:
          return ordinalConverter.write(12, into);
      }
    }
    allocationSize(value) {
      return ordinalConverter.allocationSize(0);
    }
  }
  return new FFIConverter();
})();
var CursorVisualOutput = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeCursorVisualOutput = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        requestedAction: FfiConverterTypeCursorAction.read(from),
        resolvedAction: FfiConverterTypeCursorAction.read(from),
        modifiers: FfiConverterSequenceString.read(from),
        phase: FfiConverterString.read(from),
        frame: FfiConverterUInt64.read(from),
        preemptedCount: FfiConverterUInt64.read(from)
      };
    }
    write(value, into) {
      FfiConverterTypeCursorAction.write(value.requestedAction, into);
      FfiConverterTypeCursorAction.write(value.resolvedAction, into);
      FfiConverterSequenceString.write(value.modifiers, into);
      FfiConverterString.write(value.phase, into);
      FfiConverterUInt64.write(value.frame, into);
      FfiConverterUInt64.write(value.preemptedCount, into);
    }
    allocationSize(value) {
      return FfiConverterTypeCursorAction.allocationSize(value.requestedAction) + FfiConverterTypeCursorAction.allocationSize(value.resolvedAction) + FfiConverterSequenceString.allocationSize(value.modifiers) + FfiConverterString.allocationSize(value.phase) + FfiConverterUInt64.allocationSize(value.frame) + FfiConverterUInt64.allocationSize(value.preemptedCount);
    }
  }
  ;
  return new FFIConverter();
})();
var DesktopScope;
(function(DesktopScope2) {
  DesktopScope2[DesktopScope2["Desktop"] = 0] = "Desktop";
})(DesktopScope || (DesktopScope = {}));
var FfiConverterTypeDesktopScope = (() => {
  const ordinalConverter = FfiConverterInt32;
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      switch (ordinalConverter.read(from)) {
        case 1:
          return DesktopScope.Desktop;
        default:
          throw new UniffiInternalError.UnexpectedEnumCase();
      }
    }
    write(value, into) {
      switch (value) {
        case DesktopScope.Desktop:
          return ordinalConverter.write(1, into);
      }
    }
    allocationSize(value) {
      return ordinalConverter.allocationSize(0);
    }
  }
  return new FFIConverter();
})();
var DragInput = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeDragInput = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        fromX: FfiConverterFloat64.read(from),
        fromY: FfiConverterFloat64.read(from),
        toX: FfiConverterFloat64.read(from),
        toY: FfiConverterFloat64.read(from),
        target: FfiConverterOptionalTypeActionTarget.read(from),
        scope: FfiConverterOptionalTypeDesktopScope.read(from),
        session: FfiConverterOptionalString.read(from),
        durationMs: FfiConverterOptionalUInt64.read(from),
        steps: FfiConverterOptionalUInt64.read(from),
        button: FfiConverterOptionalTypeClickButton.read(from),
        modifier: FfiConverterOptionalSequenceString.read(from)
      };
    }
    write(value, into) {
      FfiConverterFloat64.write(value.fromX, into);
      FfiConverterFloat64.write(value.fromY, into);
      FfiConverterFloat64.write(value.toX, into);
      FfiConverterFloat64.write(value.toY, into);
      FfiConverterOptionalTypeActionTarget.write(value.target, into);
      FfiConverterOptionalTypeDesktopScope.write(value.scope, into);
      FfiConverterOptionalString.write(value.session, into);
      FfiConverterOptionalUInt64.write(value.durationMs, into);
      FfiConverterOptionalUInt64.write(value.steps, into);
      FfiConverterOptionalTypeClickButton.write(value.button, into);
      FfiConverterOptionalSequenceString.write(value.modifier, into);
    }
    allocationSize(value) {
      return FfiConverterFloat64.allocationSize(value.fromX) + FfiConverterFloat64.allocationSize(value.fromY) + FfiConverterFloat64.allocationSize(value.toX) + FfiConverterFloat64.allocationSize(value.toY) + FfiConverterOptionalTypeActionTarget.allocationSize(value.target) + FfiConverterOptionalTypeDesktopScope.allocationSize(value.scope) + FfiConverterOptionalString.allocationSize(value.session) + FfiConverterOptionalUInt64.allocationSize(value.durationMs) + FfiConverterOptionalUInt64.allocationSize(value.steps) + FfiConverterOptionalTypeClickButton.allocationSize(value.button) + FfiConverterOptionalSequenceString.allocationSize(value.modifier);
    }
  }
  ;
  return new FFIConverter();
})();
var ElementFrame = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeElementFrame = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        x: FfiConverterFloat64.read(from),
        y: FfiConverterFloat64.read(from),
        w: FfiConverterFloat64.read(from),
        h: FfiConverterFloat64.read(from)
      };
    }
    write(value, into) {
      FfiConverterFloat64.write(value.x, into);
      FfiConverterFloat64.write(value.y, into);
      FfiConverterFloat64.write(value.w, into);
      FfiConverterFloat64.write(value.h, into);
    }
    allocationSize(value) {
      return FfiConverterFloat64.allocationSize(value.x) + FfiConverterFloat64.allocationSize(value.y) + FfiConverterFloat64.allocationSize(value.w) + FfiConverterFloat64.allocationSize(value.h);
    }
  }
  ;
  return new FFIConverter();
})();
var ElementSelector = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeElementSelector = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        role: FfiConverterOptionalString.read(from),
        labelContains: FfiConverterOptionalString.read(from)
      };
    }
    write(value, into) {
      FfiConverterOptionalString.write(value.role, into);
      FfiConverterOptionalString.write(value.labelContains, into);
    }
    allocationSize(value) {
      return FfiConverterOptionalString.allocationSize(value.role) + FfiConverterOptionalString.allocationSize(value.labelContains);
    }
  }
  ;
  return new FFIConverter();
})();
var ElementPredicate = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeElementPredicate = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        selector: FfiConverterTypeElementSelector.read(from),
        exists: FfiConverterOptionalBoolean.read(from),
        valueEquals: FfiConverterOptionalString.read(from),
        enabled: FfiConverterOptionalBoolean.read(from),
        selected: FfiConverterOptionalBoolean.read(from)
      };
    }
    write(value, into) {
      FfiConverterTypeElementSelector.write(value.selector, into);
      FfiConverterOptionalBoolean.write(value.exists, into);
      FfiConverterOptionalString.write(value.valueEquals, into);
      FfiConverterOptionalBoolean.write(value.enabled, into);
      FfiConverterOptionalBoolean.write(value.selected, into);
    }
    allocationSize(value) {
      return FfiConverterTypeElementSelector.allocationSize(value.selector) + FfiConverterOptionalBoolean.allocationSize(value.exists) + FfiConverterOptionalString.allocationSize(value.valueEquals) + FfiConverterOptionalBoolean.allocationSize(value.enabled) + FfiConverterOptionalBoolean.allocationSize(value.selected);
    }
  }
  ;
  return new FFIConverter();
})();
var EndSessionInput = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeEndSessionInput = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        session: FfiConverterOptionalString.read(from)
      };
    }
    write(value, into) {
      FfiConverterOptionalString.write(value.session, into);
    }
    allocationSize(value) {
      return FfiConverterOptionalString.allocationSize(value.session);
    }
  }
  ;
  return new FFIConverter();
})();
var EndSessionOutput = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeEndSessionOutput = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        session: FfiConverterString.read(from),
        active: FfiConverterBool.read(from)
      };
    }
    write(value, into) {
      FfiConverterString.write(value.session, into);
      FfiConverterBool.write(value.active, into);
    }
    allocationSize(value) {
      return FfiConverterString.allocationSize(value.session) + FfiConverterBool.allocationSize(value.active);
    }
  }
  ;
  return new FFIConverter();
})();
var EscalationReason;
(function(EscalationReason2) {
  EscalationReason2[EscalationReason2["AxTreePixelMismatch"] = 0] = "AxTreePixelMismatch";
  EscalationReason2[EscalationReason2["BackgroundDeliveryFailed"] = 1] = "BackgroundDeliveryFailed";
  EscalationReason2[EscalationReason2["ForegroundIneffective"] = 2] = "ForegroundIneffective";
  EscalationReason2[EscalationReason2["NoWindowTarget"] = 3] = "NoWindowTarget";
  EscalationReason2[EscalationReason2["Other"] = 4] = "Other";
})(EscalationReason || (EscalationReason = {}));
var FfiConverterTypeEscalationReason = (() => {
  const ordinalConverter = FfiConverterInt32;
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      switch (ordinalConverter.read(from)) {
        case 1:
          return EscalationReason.AxTreePixelMismatch;
        case 2:
          return EscalationReason.BackgroundDeliveryFailed;
        case 3:
          return EscalationReason.ForegroundIneffective;
        case 4:
          return EscalationReason.NoWindowTarget;
        case 5:
          return EscalationReason.Other;
        default:
          throw new UniffiInternalError.UnexpectedEnumCase();
      }
    }
    write(value, into) {
      switch (value) {
        case EscalationReason.AxTreePixelMismatch:
          return ordinalConverter.write(1, into);
        case EscalationReason.BackgroundDeliveryFailed:
          return ordinalConverter.write(2, into);
        case EscalationReason.ForegroundIneffective:
          return ordinalConverter.write(3, into);
        case EscalationReason.NoWindowTarget:
          return ordinalConverter.write(4, into);
        case EscalationReason.Other:
          return ordinalConverter.write(5, into);
      }
    }
    allocationSize(value) {
      return ordinalConverter.allocationSize(0);
    }
  }
  return new FFIConverter();
})();
var EscalateSessionInput = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeEscalateSessionInput = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        session: FfiConverterString.read(from),
        reason: FfiConverterTypeEscalationReason.read(from),
        detail: FfiConverterOptionalString.read(from)
      };
    }
    write(value, into) {
      FfiConverterString.write(value.session, into);
      FfiConverterTypeEscalationReason.write(value.reason, into);
      FfiConverterOptionalString.write(value.detail, into);
    }
    allocationSize(value) {
      return FfiConverterString.allocationSize(value.session) + FfiConverterTypeEscalationReason.allocationSize(value.reason) + FfiConverterOptionalString.allocationSize(value.detail);
    }
  }
  ;
  return new FFIConverter();
})();
var GetAgentCursorStateInput = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeGetAgentCursorStateInput = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        session: FfiConverterString.read(from)
      };
    }
    write(value, into) {
      FfiConverterString.write(value.session, into);
    }
    allocationSize(value) {
      return FfiConverterString.allocationSize(value.session);
    }
  }
  ;
  return new FFIConverter();
})();
var GetAgentCursorStateOutput = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeGetAgentCursorStateOutput = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        session: FfiConverterString.read(from),
        enabled: FfiConverterBool.read(from),
        position: FfiConverterOptionalTypeCursorPointOutput.read(from),
        theme: FfiConverterTypeCursorThemeOutput.read(from),
        visualState: FfiConverterTypeCursorVisualOutput.read(from),
        motion: FfiConverterTypeCursorMotionOutput.read(from)
      };
    }
    write(value, into) {
      FfiConverterString.write(value.session, into);
      FfiConverterBool.write(value.enabled, into);
      FfiConverterOptionalTypeCursorPointOutput.write(value.position, into);
      FfiConverterTypeCursorThemeOutput.write(value.theme, into);
      FfiConverterTypeCursorVisualOutput.write(value.visualState, into);
      FfiConverterTypeCursorMotionOutput.write(value.motion, into);
    }
    allocationSize(value) {
      return FfiConverterString.allocationSize(value.session) + FfiConverterBool.allocationSize(value.enabled) + FfiConverterOptionalTypeCursorPointOutput.allocationSize(value.position) + FfiConverterTypeCursorThemeOutput.allocationSize(value.theme) + FfiConverterTypeCursorVisualOutput.allocationSize(value.visualState) + FfiConverterTypeCursorMotionOutput.allocationSize(value.motion);
    }
  }
  ;
  return new FFIConverter();
})();
var GetCursorPositionInput = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeGetCursorPositionInput = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        session: FfiConverterOptionalString.read(from)
      };
    }
    write(value, into) {
      FfiConverterOptionalString.write(value.session, into);
    }
    allocationSize(value) {
      return FfiConverterOptionalString.allocationSize(value.session);
    }
  }
  ;
  return new FFIConverter();
})();
var GetDesktopStateInput = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeGetDesktopStateInput = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        session: FfiConverterOptionalString.read(from),
        screenshotOutFile: FfiConverterOptionalString.read(from)
      };
    }
    write(value, into) {
      FfiConverterOptionalString.write(value.session, into);
      FfiConverterOptionalString.write(value.screenshotOutFile, into);
    }
    allocationSize(value) {
      return FfiConverterOptionalString.allocationSize(value.session) + FfiConverterOptionalString.allocationSize(value.screenshotOutFile);
    }
  }
  ;
  return new FFIConverter();
})();
var GetScreenSizeInput = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeGetScreenSizeInput = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        session: FfiConverterOptionalString.read(from)
      };
    }
    write(value, into) {
      FfiConverterOptionalString.write(value.session, into);
    }
    allocationSize(value) {
      return FfiConverterOptionalString.allocationSize(value.session);
    }
  }
  ;
  return new FFIConverter();
})();
var GetSessionInput = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeGetSessionInput = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        session: FfiConverterOptionalString.read(from)
      };
    }
    write(value, into) {
      FfiConverterOptionalString.write(value.session, into);
    }
    allocationSize(value) {
      return FfiConverterOptionalString.allocationSize(value.session);
    }
  }
  ;
  return new FFIConverter();
})();
var GetSessionStateInput = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeGetSessionStateInput = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        session: FfiConverterOptionalString.read(from)
      };
    }
    write(value, into) {
      FfiConverterOptionalString.write(value.session, into);
    }
    allocationSize(value) {
      return FfiConverterOptionalString.allocationSize(value.session);
    }
  }
  ;
  return new FFIConverter();
})();
var GetWindowStateInput = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeGetWindowStateInput = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        pid: FfiConverterUInt32.read(from),
        windowId: FfiConverterUInt64.read(from),
        session: FfiConverterOptionalString.read(from),
        query: FfiConverterOptionalString.read(from),
        includeAccessibilityTree: FfiConverterOptionalBoolean.read(from),
        includeScreenshot: FfiConverterOptionalBoolean.read(from),
        screenshotOutFile: FfiConverterOptionalString.read(from),
        maxElements: FfiConverterOptionalUInt32.read(from),
        maxDepth: FfiConverterOptionalUInt32.read(from),
        maxDimension: FfiConverterOptionalUInt32.read(from)
      };
    }
    write(value, into) {
      FfiConverterUInt32.write(value.pid, into);
      FfiConverterUInt64.write(value.windowId, into);
      FfiConverterOptionalString.write(value.session, into);
      FfiConverterOptionalString.write(value.query, into);
      FfiConverterOptionalBoolean.write(value.includeAccessibilityTree, into);
      FfiConverterOptionalBoolean.write(value.includeScreenshot, into);
      FfiConverterOptionalString.write(value.screenshotOutFile, into);
      FfiConverterOptionalUInt32.write(value.maxElements, into);
      FfiConverterOptionalUInt32.write(value.maxDepth, into);
      FfiConverterOptionalUInt32.write(value.maxDimension, into);
    }
    allocationSize(value) {
      return FfiConverterUInt32.allocationSize(value.pid) + FfiConverterUInt64.allocationSize(value.windowId) + FfiConverterOptionalString.allocationSize(value.session) + FfiConverterOptionalString.allocationSize(value.query) + FfiConverterOptionalBoolean.allocationSize(value.includeAccessibilityTree) + FfiConverterOptionalBoolean.allocationSize(value.includeScreenshot) + FfiConverterOptionalString.allocationSize(value.screenshotOutFile) + FfiConverterOptionalUInt32.allocationSize(value.maxElements) + FfiConverterOptionalUInt32.allocationSize(value.maxDepth) + FfiConverterOptionalUInt32.allocationSize(value.maxDimension);
    }
  }
  ;
  return new FFIConverter();
})();
var HotkeyInput = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeHotkeyInput = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        keys: FfiConverterSequenceString.read(from),
        target: FfiConverterOptionalTypeActionTarget.read(from),
        scope: FfiConverterOptionalTypeDesktopScope.read(from),
        session: FfiConverterOptionalString.read(from)
      };
    }
    write(value, into) {
      FfiConverterSequenceString.write(value.keys, into);
      FfiConverterOptionalTypeActionTarget.write(value.target, into);
      FfiConverterOptionalTypeDesktopScope.write(value.scope, into);
      FfiConverterOptionalString.write(value.session, into);
    }
    allocationSize(value) {
      return FfiConverterSequenceString.allocationSize(value.keys) + FfiConverterOptionalTypeActionTarget.allocationSize(value.target) + FfiConverterOptionalTypeDesktopScope.allocationSize(value.scope) + FfiConverterOptionalString.allocationSize(value.session);
    }
  }
  ;
  return new FFIConverter();
})();
var InvokeMenuInput = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeInvokeMenuInput = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        pid: FfiConverterUInt32.read(from),
        windowId: FfiConverterUInt64.read(from),
        path: FfiConverterSequenceString.read(from),
        session: FfiConverterOptionalString.read(from)
      };
    }
    write(value, into) {
      FfiConverterUInt32.write(value.pid, into);
      FfiConverterUInt64.write(value.windowId, into);
      FfiConverterSequenceString.write(value.path, into);
      FfiConverterOptionalString.write(value.session, into);
    }
    allocationSize(value) {
      return FfiConverterUInt32.allocationSize(value.pid) + FfiConverterUInt64.allocationSize(value.windowId) + FfiConverterSequenceString.allocationSize(value.path) + FfiConverterOptionalString.allocationSize(value.session);
    }
  }
  ;
  return new FFIConverter();
})();
var ListAppsInput = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeListAppsInput = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {};
    }
    write(value, into) {
    }
    allocationSize(value) {
      return 0;
    }
  }
  ;
  return new FFIConverter();
})();
var ListAppsOutput = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeListAppsOutput = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        apps: FfiConverterSequenceTypeAppInfo.read(from)
      };
    }
    write(value, into) {
      FfiConverterSequenceTypeAppInfo.write(value.apps, into);
    }
    allocationSize(value) {
      return FfiConverterSequenceTypeAppInfo.allocationSize(value.apps);
    }
  }
  ;
  return new FFIConverter();
})();
var ListSessionsInput = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeListSessionsInput = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        limit: FfiConverterOptionalUInt32.read(from),
        cursor: FfiConverterOptionalString.read(from)
      };
    }
    write(value, into) {
      FfiConverterOptionalUInt32.write(value.limit, into);
      FfiConverterOptionalString.write(value.cursor, into);
    }
    allocationSize(value) {
      return FfiConverterOptionalUInt32.allocationSize(value.limit) + FfiConverterOptionalString.allocationSize(value.cursor);
    }
  }
  ;
  return new FFIConverter();
})();
var SessionLifecycleState;
(function(SessionLifecycleState2) {
  SessionLifecycleState2[SessionLifecycleState2["Active"] = 0] = "Active";
  SessionLifecycleState2[SessionLifecycleState2["Ending"] = 1] = "Ending";
})(SessionLifecycleState || (SessionLifecycleState = {}));
var FfiConverterTypeSessionLifecycleState = (() => {
  const ordinalConverter = FfiConverterInt32;
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      switch (ordinalConverter.read(from)) {
        case 1:
          return SessionLifecycleState.Active;
        case 2:
          return SessionLifecycleState.Ending;
        default:
          throw new UniffiInternalError.UnexpectedEnumCase();
      }
    }
    write(value, into) {
      switch (value) {
        case SessionLifecycleState.Active:
          return ordinalConverter.write(1, into);
        case SessionLifecycleState.Ending:
          return ordinalConverter.write(2, into);
      }
    }
    allocationSize(value) {
      return ordinalConverter.allocationSize(0);
    }
  }
  return new FFIConverter();
})();
var SessionClientKindOutput;
(function(SessionClientKindOutput2) {
  SessionClientKindOutput2[SessionClientKindOutput2["Cli"] = 0] = "Cli";
  SessionClientKindOutput2[SessionClientKindOutput2["Direct"] = 1] = "Direct";
  SessionClientKindOutput2[SessionClientKindOutput2["Mcp"] = 2] = "Mcp";
  SessionClientKindOutput2[SessionClientKindOutput2["PythonSdk"] = 3] = "PythonSdk";
  SessionClientKindOutput2[SessionClientKindOutput2["TypescriptSdk"] = 4] = "TypescriptSdk";
})(SessionClientKindOutput || (SessionClientKindOutput = {}));
var FfiConverterTypeSessionClientKindOutput = (() => {
  const ordinalConverter = FfiConverterInt32;
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      switch (ordinalConverter.read(from)) {
        case 1:
          return SessionClientKindOutput.Cli;
        case 2:
          return SessionClientKindOutput.Direct;
        case 3:
          return SessionClientKindOutput.Mcp;
        case 4:
          return SessionClientKindOutput.PythonSdk;
        case 5:
          return SessionClientKindOutput.TypescriptSdk;
        default:
          throw new UniffiInternalError.UnexpectedEnumCase();
      }
    }
    write(value, into) {
      switch (value) {
        case SessionClientKindOutput.Cli:
          return ordinalConverter.write(1, into);
        case SessionClientKindOutput.Direct:
          return ordinalConverter.write(2, into);
        case SessionClientKindOutput.Mcp:
          return ordinalConverter.write(3, into);
        case SessionClientKindOutput.PythonSdk:
          return ordinalConverter.write(4, into);
        case SessionClientKindOutput.TypescriptSdk:
          return ordinalConverter.write(5, into);
      }
    }
    allocationSize(value) {
      return ordinalConverter.allocationSize(0);
    }
  }
  return new FFIConverter();
})();
var SessionTransportOutput;
(function(SessionTransportOutput2) {
  SessionTransportOutput2[SessionTransportOutput2["Cli"] = 0] = "Cli";
  SessionTransportOutput2[SessionTransportOutput2["Daemon"] = 1] = "Daemon";
  SessionTransportOutput2[SessionTransportOutput2["McpStdio"] = 2] = "McpStdio";
  SessionTransportOutput2[SessionTransportOutput2["McpHttp"] = 3] = "McpHttp";
})(SessionTransportOutput || (SessionTransportOutput = {}));
var FfiConverterTypeSessionTransportOutput = (() => {
  const ordinalConverter = FfiConverterInt32;
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      switch (ordinalConverter.read(from)) {
        case 1:
          return SessionTransportOutput.Cli;
        case 2:
          return SessionTransportOutput.Daemon;
        case 3:
          return SessionTransportOutput.McpStdio;
        case 4:
          return SessionTransportOutput.McpHttp;
        default:
          throw new UniffiInternalError.UnexpectedEnumCase();
      }
    }
    write(value, into) {
      switch (value) {
        case SessionTransportOutput.Cli:
          return ordinalConverter.write(1, into);
        case SessionTransportOutput.Daemon:
          return ordinalConverter.write(2, into);
        case SessionTransportOutput.McpStdio:
          return ordinalConverter.write(3, into);
        case SessionTransportOutput.McpHttp:
          return ordinalConverter.write(4, into);
      }
    }
    allocationSize(value) {
      return ordinalConverter.allocationSize(0);
    }
  }
  return new FFIConverter();
})();
var SessionOutput = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeSessionOutput = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        session: FfiConverterOptionalString.read(from),
        implicit: FfiConverterBool.read(from),
        state: FfiConverterTypeSessionLifecycleState.read(from),
        clientKind: FfiConverterTypeSessionClientKindOutput.read(from),
        transport: FfiConverterTypeSessionTransportOutput.read(from),
        cursorVisible: FfiConverterBool.read(from),
        recordingActive: FfiConverterBool.read(from),
        idleSeconds: FfiConverterUInt64.read(from),
        expiresInSeconds: FfiConverterUInt64.read(from)
      };
    }
    write(value, into) {
      FfiConverterOptionalString.write(value.session, into);
      FfiConverterBool.write(value.implicit, into);
      FfiConverterTypeSessionLifecycleState.write(value.state, into);
      FfiConverterTypeSessionClientKindOutput.write(value.clientKind, into);
      FfiConverterTypeSessionTransportOutput.write(value.transport, into);
      FfiConverterBool.write(value.cursorVisible, into);
      FfiConverterBool.write(value.recordingActive, into);
      FfiConverterUInt64.write(value.idleSeconds, into);
      FfiConverterUInt64.write(value.expiresInSeconds, into);
    }
    allocationSize(value) {
      return FfiConverterOptionalString.allocationSize(value.session) + FfiConverterBool.allocationSize(value.implicit) + FfiConverterTypeSessionLifecycleState.allocationSize(value.state) + FfiConverterTypeSessionClientKindOutput.allocationSize(value.clientKind) + FfiConverterTypeSessionTransportOutput.allocationSize(value.transport) + FfiConverterBool.allocationSize(value.cursorVisible) + FfiConverterBool.allocationSize(value.recordingActive) + FfiConverterUInt64.allocationSize(value.idleSeconds) + FfiConverterUInt64.allocationSize(value.expiresInSeconds);
    }
  }
  ;
  return new FFIConverter();
})();
var ListSessionsOutput = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeListSessionsOutput = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        sessions: FfiConverterSequenceTypeSessionOutput.read(from),
        nextCursor: FfiConverterOptionalString.read(from)
      };
    }
    write(value, into) {
      FfiConverterSequenceTypeSessionOutput.write(value.sessions, into);
      FfiConverterOptionalString.write(value.nextCursor, into);
    }
    allocationSize(value) {
      return FfiConverterSequenceTypeSessionOutput.allocationSize(value.sessions) + FfiConverterOptionalString.allocationSize(value.nextCursor);
    }
  }
  ;
  return new FFIConverter();
})();
var ListWindowsInput = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeListWindowsInput = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        pid: FfiConverterOptionalUInt32.read(from),
        onScreenOnly: FfiConverterOptionalBoolean.read(from)
      };
    }
    write(value, into) {
      FfiConverterOptionalUInt32.write(value.pid, into);
      FfiConverterOptionalBoolean.write(value.onScreenOnly, into);
    }
    allocationSize(value) {
      return FfiConverterOptionalUInt32.allocationSize(value.pid) + FfiConverterOptionalBoolean.allocationSize(value.onScreenOnly);
    }
  }
  ;
  return new FFIConverter();
})();
var WindowBounds = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeWindowBounds = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        x: FfiConverterFloat64.read(from),
        y: FfiConverterFloat64.read(from),
        width: FfiConverterFloat64.read(from),
        height: FfiConverterFloat64.read(from)
      };
    }
    write(value, into) {
      FfiConverterFloat64.write(value.x, into);
      FfiConverterFloat64.write(value.y, into);
      FfiConverterFloat64.write(value.width, into);
      FfiConverterFloat64.write(value.height, into);
    }
    allocationSize(value) {
      return FfiConverterFloat64.allocationSize(value.x) + FfiConverterFloat64.allocationSize(value.y) + FfiConverterFloat64.allocationSize(value.width) + FfiConverterFloat64.allocationSize(value.height);
    }
  }
  ;
  return new FFIConverter();
})();
var WindowInfo = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeWindowInfo = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        windowId: FfiConverterUInt64.read(from),
        pid: FfiConverterOptionalUInt32.read(from),
        appName: FfiConverterString.read(from),
        title: FfiConverterString.read(from),
        bounds: FfiConverterTypeWindowBounds.read(from),
        isOnScreen: FfiConverterBool.read(from),
        zIndex: FfiConverterOptionalInt64.read(from),
        layer: FfiConverterOptionalInt32.read(from),
        minimized: FfiConverterOptionalBoolean.read(from),
        currentSpaceId: FfiConverterOptionalUInt64.read(from),
        onCurrentSpace: FfiConverterOptionalBoolean.read(from),
        spaceIds: FfiConverterOptionalSequenceUInt64.read(from)
      };
    }
    write(value, into) {
      FfiConverterUInt64.write(value.windowId, into);
      FfiConverterOptionalUInt32.write(value.pid, into);
      FfiConverterString.write(value.appName, into);
      FfiConverterString.write(value.title, into);
      FfiConverterTypeWindowBounds.write(value.bounds, into);
      FfiConverterBool.write(value.isOnScreen, into);
      FfiConverterOptionalInt64.write(value.zIndex, into);
      FfiConverterOptionalInt32.write(value.layer, into);
      FfiConverterOptionalBoolean.write(value.minimized, into);
      FfiConverterOptionalUInt64.write(value.currentSpaceId, into);
      FfiConverterOptionalBoolean.write(value.onCurrentSpace, into);
      FfiConverterOptionalSequenceUInt64.write(value.spaceIds, into);
    }
    allocationSize(value) {
      return FfiConverterUInt64.allocationSize(value.windowId) + FfiConverterOptionalUInt32.allocationSize(value.pid) + FfiConverterString.allocationSize(value.appName) + FfiConverterString.allocationSize(value.title) + FfiConverterTypeWindowBounds.allocationSize(value.bounds) + FfiConverterBool.allocationSize(value.isOnScreen) + FfiConverterOptionalInt64.allocationSize(value.zIndex) + FfiConverterOptionalInt32.allocationSize(value.layer) + FfiConverterOptionalBoolean.allocationSize(value.minimized) + FfiConverterOptionalUInt64.allocationSize(value.currentSpaceId) + FfiConverterOptionalBoolean.allocationSize(value.onCurrentSpace) + FfiConverterOptionalSequenceUInt64.allocationSize(value.spaceIds);
    }
  }
  ;
  return new FFIConverter();
})();
var ListWindowsOutput = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeListWindowsOutput = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        windows: FfiConverterSequenceTypeWindowInfo.read(from),
        currentSpaceId: FfiConverterOptionalUInt64.read(from)
      };
    }
    write(value, into) {
      FfiConverterSequenceTypeWindowInfo.write(value.windows, into);
      FfiConverterOptionalUInt64.write(value.currentSpaceId, into);
    }
    allocationSize(value) {
      return FfiConverterSequenceTypeWindowInfo.allocationSize(value.windows) + FfiConverterOptionalUInt64.allocationSize(value.currentSpaceId);
    }
  }
  ;
  return new FFIConverter();
})();
var MoveCursorInput = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeMoveCursorInput = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        x: FfiConverterFloat64.read(from),
        y: FfiConverterFloat64.read(from),
        target: FfiConverterOptionalTypeActionTarget.read(from),
        scope: FfiConverterOptionalTypeDesktopScope.read(from),
        session: FfiConverterOptionalString.read(from)
      };
    }
    write(value, into) {
      FfiConverterFloat64.write(value.x, into);
      FfiConverterFloat64.write(value.y, into);
      FfiConverterOptionalTypeActionTarget.write(value.target, into);
      FfiConverterOptionalTypeDesktopScope.write(value.scope, into);
      FfiConverterOptionalString.write(value.session, into);
    }
    allocationSize(value) {
      return FfiConverterFloat64.allocationSize(value.x) + FfiConverterFloat64.allocationSize(value.y) + FfiConverterOptionalTypeActionTarget.allocationSize(value.target) + FfiConverterOptionalTypeDesktopScope.allocationSize(value.scope) + FfiConverterOptionalString.allocationSize(value.session);
    }
  }
  ;
  return new FFIConverter();
})();
var VerificationStatus;
(function(VerificationStatus2) {
  VerificationStatus2[VerificationStatus2["Satisfied"] = 0] = "Satisfied";
  VerificationStatus2[VerificationStatus2["Unsatisfied"] = 1] = "Unsatisfied";
  VerificationStatus2[VerificationStatus2["Unknown"] = 2] = "Unknown";
})(VerificationStatus || (VerificationStatus = {}));
var FfiConverterTypeVerificationStatus = (() => {
  const ordinalConverter = FfiConverterInt32;
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      switch (ordinalConverter.read(from)) {
        case 1:
          return VerificationStatus.Satisfied;
        case 2:
          return VerificationStatus.Unsatisfied;
        case 3:
          return VerificationStatus.Unknown;
        default:
          throw new UniffiInternalError.UnexpectedEnumCase();
      }
    }
    write(value, into) {
      switch (value) {
        case VerificationStatus.Satisfied:
          return ordinalConverter.write(1, into);
        case VerificationStatus.Unsatisfied:
          return ordinalConverter.write(2, into);
        case VerificationStatus.Unknown:
          return ordinalConverter.write(3, into);
      }
    }
    allocationSize(value) {
      return ordinalConverter.allocationSize(0);
    }
  }
  return new FFIConverter();
})();
var UnknownReason;
(function(UnknownReason2) {
  UnknownReason2[UnknownReason2["InvalidPredicate"] = 0] = "InvalidPredicate";
  UnknownReason2[UnknownReason2["UnsupportedPredicate"] = 1] = "UnsupportedPredicate";
  UnknownReason2[UnknownReason2["UntrustedSource"] = 2] = "UntrustedSource";
  UnknownReason2[UnknownReason2["MultiMatch"] = 3] = "MultiMatch";
  UnknownReason2[UnknownReason2["TargetMissing"] = 4] = "TargetMissing";
  UnknownReason2[UnknownReason2["ObservationUnavailable"] = 5] = "ObservationUnavailable";
  UnknownReason2[UnknownReason2["StabilityUnproven"] = 6] = "StabilityUnproven";
})(UnknownReason || (UnknownReason = {}));
var FfiConverterTypeUnknownReason = (() => {
  const ordinalConverter = FfiConverterInt32;
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      switch (ordinalConverter.read(from)) {
        case 1:
          return UnknownReason.InvalidPredicate;
        case 2:
          return UnknownReason.UnsupportedPredicate;
        case 3:
          return UnknownReason.UntrustedSource;
        case 4:
          return UnknownReason.MultiMatch;
        case 5:
          return UnknownReason.TargetMissing;
        case 6:
          return UnknownReason.ObservationUnavailable;
        case 7:
          return UnknownReason.StabilityUnproven;
        default:
          throw new UniffiInternalError.UnexpectedEnumCase();
      }
    }
    write(value, into) {
      switch (value) {
        case UnknownReason.InvalidPredicate:
          return ordinalConverter.write(1, into);
        case UnknownReason.UnsupportedPredicate:
          return ordinalConverter.write(2, into);
        case UnknownReason.UntrustedSource:
          return ordinalConverter.write(3, into);
        case UnknownReason.MultiMatch:
          return ordinalConverter.write(4, into);
        case UnknownReason.TargetMissing:
          return ordinalConverter.write(5, into);
        case UnknownReason.ObservationUnavailable:
          return ordinalConverter.write(6, into);
        case UnknownReason.StabilityUnproven:
          return ordinalConverter.write(7, into);
      }
    }
    allocationSize(value) {
      return ordinalConverter.allocationSize(0);
    }
  }
  return new FFIConverter();
})();
var PredicateOutcome = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypePredicateOutcome = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        index: FfiConverterUInt64.read(from),
        status: FfiConverterTypeVerificationStatus.read(from),
        unknownReason: FfiConverterOptionalTypeUnknownReason.read(from),
        observedJson: FfiConverterOptionalString.read(from)
      };
    }
    write(value, into) {
      FfiConverterUInt64.write(value.index, into);
      FfiConverterTypeVerificationStatus.write(value.status, into);
      FfiConverterOptionalTypeUnknownReason.write(value.unknownReason, into);
      FfiConverterOptionalString.write(value.observedJson, into);
    }
    allocationSize(value) {
      return FfiConverterUInt64.allocationSize(value.index) + FfiConverterTypeVerificationStatus.allocationSize(value.status) + FfiConverterOptionalTypeUnknownReason.allocationSize(value.unknownReason) + FfiConverterOptionalString.allocationSize(value.observedJson);
    }
  }
  ;
  return new FFIConverter();
})();
var PressKeyInput = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypePressKeyInput = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        key: FfiConverterString.read(from),
        target: FfiConverterOptionalTypeActionTarget.read(from),
        scope: FfiConverterOptionalTypeDesktopScope.read(from),
        session: FfiConverterOptionalString.read(from),
        modifiers: FfiConverterOptionalSequenceString.read(from)
      };
    }
    write(value, into) {
      FfiConverterString.write(value.key, into);
      FfiConverterOptionalTypeActionTarget.write(value.target, into);
      FfiConverterOptionalTypeDesktopScope.write(value.scope, into);
      FfiConverterOptionalString.write(value.session, into);
      FfiConverterOptionalSequenceString.write(value.modifiers, into);
    }
    allocationSize(value) {
      return FfiConverterString.allocationSize(value.key) + FfiConverterOptionalTypeActionTarget.allocationSize(value.target) + FfiConverterOptionalTypeDesktopScope.allocationSize(value.scope) + FfiConverterOptionalString.allocationSize(value.session) + FfiConverterOptionalSequenceString.allocationSize(value.modifiers);
    }
  }
  ;
  return new FFIConverter();
})();
var ScrollDirection;
(function(ScrollDirection2) {
  ScrollDirection2[ScrollDirection2["Up"] = 0] = "Up";
  ScrollDirection2[ScrollDirection2["Down"] = 1] = "Down";
  ScrollDirection2[ScrollDirection2["Left"] = 2] = "Left";
  ScrollDirection2[ScrollDirection2["Right"] = 3] = "Right";
})(ScrollDirection || (ScrollDirection = {}));
var FfiConverterTypeScrollDirection = (() => {
  const ordinalConverter = FfiConverterInt32;
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      switch (ordinalConverter.read(from)) {
        case 1:
          return ScrollDirection.Up;
        case 2:
          return ScrollDirection.Down;
        case 3:
          return ScrollDirection.Left;
        case 4:
          return ScrollDirection.Right;
        default:
          throw new UniffiInternalError.UnexpectedEnumCase();
      }
    }
    write(value, into) {
      switch (value) {
        case ScrollDirection.Up:
          return ordinalConverter.write(1, into);
        case ScrollDirection.Down:
          return ordinalConverter.write(2, into);
        case ScrollDirection.Left:
          return ordinalConverter.write(3, into);
        case ScrollDirection.Right:
          return ordinalConverter.write(4, into);
      }
    }
    allocationSize(value) {
      return ordinalConverter.allocationSize(0);
    }
  }
  return new FFIConverter();
})();
var ScrollBy;
(function(ScrollBy2) {
  ScrollBy2[ScrollBy2["Line"] = 0] = "Line";
  ScrollBy2[ScrollBy2["Page"] = 1] = "Page";
})(ScrollBy || (ScrollBy = {}));
var FfiConverterTypeScrollBy = (() => {
  const ordinalConverter = FfiConverterInt32;
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      switch (ordinalConverter.read(from)) {
        case 1:
          return ScrollBy.Line;
        case 2:
          return ScrollBy.Page;
        default:
          throw new UniffiInternalError.UnexpectedEnumCase();
      }
    }
    write(value, into) {
      switch (value) {
        case ScrollBy.Line:
          return ordinalConverter.write(1, into);
        case ScrollBy.Page:
          return ordinalConverter.write(2, into);
      }
    }
    allocationSize(value) {
      return ordinalConverter.allocationSize(0);
    }
  }
  return new FFIConverter();
})();
var ScrollInput = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeScrollInput = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        x: FfiConverterFloat64.read(from),
        y: FfiConverterFloat64.read(from),
        direction: FfiConverterTypeScrollDirection.read(from),
        target: FfiConverterOptionalTypeActionTarget.read(from),
        scope: FfiConverterOptionalTypeDesktopScope.read(from),
        session: FfiConverterOptionalString.read(from),
        by: FfiConverterOptionalTypeScrollBy.read(from),
        amount: FfiConverterOptionalUInt64.read(from)
      };
    }
    write(value, into) {
      FfiConverterFloat64.write(value.x, into);
      FfiConverterFloat64.write(value.y, into);
      FfiConverterTypeScrollDirection.write(value.direction, into);
      FfiConverterOptionalTypeActionTarget.write(value.target, into);
      FfiConverterOptionalTypeDesktopScope.write(value.scope, into);
      FfiConverterOptionalString.write(value.session, into);
      FfiConverterOptionalTypeScrollBy.write(value.by, into);
      FfiConverterOptionalUInt64.write(value.amount, into);
    }
    allocationSize(value) {
      return FfiConverterFloat64.allocationSize(value.x) + FfiConverterFloat64.allocationSize(value.y) + FfiConverterTypeScrollDirection.allocationSize(value.direction) + FfiConverterOptionalTypeActionTarget.allocationSize(value.target) + FfiConverterOptionalTypeDesktopScope.allocationSize(value.scope) + FfiConverterOptionalString.allocationSize(value.session) + FfiConverterOptionalTypeScrollBy.allocationSize(value.by) + FfiConverterOptionalUInt64.allocationSize(value.amount);
    }
  }
  ;
  return new FFIConverter();
})();
var CaptureScope;
(function(CaptureScope2) {
  CaptureScope2[CaptureScope2["Auto"] = 0] = "Auto";
  CaptureScope2[CaptureScope2["Window"] = 1] = "Window";
  CaptureScope2[CaptureScope2["Desktop"] = 2] = "Desktop";
})(CaptureScope || (CaptureScope = {}));
var FfiConverterTypeCaptureScope = (() => {
  const ordinalConverter = FfiConverterInt32;
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      switch (ordinalConverter.read(from)) {
        case 1:
          return CaptureScope.Auto;
        case 2:
          return CaptureScope.Window;
        case 3:
          return CaptureScope.Desktop;
        default:
          throw new UniffiInternalError.UnexpectedEnumCase();
      }
    }
    write(value, into) {
      switch (value) {
        case CaptureScope.Auto:
          return ordinalConverter.write(1, into);
        case CaptureScope.Window:
          return ordinalConverter.write(2, into);
        case CaptureScope.Desktop:
          return ordinalConverter.write(3, into);
      }
    }
    allocationSize(value) {
      return ordinalConverter.allocationSize(0);
    }
  }
  return new FFIConverter();
})();
var EffectiveScope;
(function(EffectiveScope2) {
  EffectiveScope2[EffectiveScope2["Window"] = 0] = "Window";
  EffectiveScope2[EffectiveScope2["Desktop"] = 1] = "Desktop";
})(EffectiveScope || (EffectiveScope = {}));
var FfiConverterTypeEffectiveScope = (() => {
  const ordinalConverter = FfiConverterInt32;
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      switch (ordinalConverter.read(from)) {
        case 1:
          return EffectiveScope.Window;
        case 2:
          return EffectiveScope.Desktop;
        default:
          throw new UniffiInternalError.UnexpectedEnumCase();
      }
    }
    write(value, into) {
      switch (value) {
        case EffectiveScope.Window:
          return ordinalConverter.write(1, into);
        case EffectiveScope.Desktop:
          return ordinalConverter.write(2, into);
      }
    }
    allocationSize(value) {
      return ordinalConverter.allocationSize(0);
    }
  }
  return new FFIConverter();
})();
var SessionStateOutput = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeSessionStateOutput = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        session: FfiConverterString.read(from),
        captureScope: FfiConverterTypeCaptureScope.read(from),
        effectiveScope: FfiConverterTypeEffectiveScope.read(from),
        desktopCaptureAuthorized: FfiConverterBool.read(from),
        desktopUnlocked: FfiConverterBool.read(from),
        escalationReason: FfiConverterOptionalTypeEscalationReason.read(from),
        escalationDetail: FfiConverterOptionalString.read(from)
      };
    }
    write(value, into) {
      FfiConverterString.write(value.session, into);
      FfiConverterTypeCaptureScope.write(value.captureScope, into);
      FfiConverterTypeEffectiveScope.write(value.effectiveScope, into);
      FfiConverterBool.write(value.desktopCaptureAuthorized, into);
      FfiConverterBool.write(value.desktopUnlocked, into);
      FfiConverterOptionalTypeEscalationReason.write(value.escalationReason, into);
      FfiConverterOptionalString.write(value.escalationDetail, into);
    }
    allocationSize(value) {
      return FfiConverterString.allocationSize(value.session) + FfiConverterTypeCaptureScope.allocationSize(value.captureScope) + FfiConverterTypeEffectiveScope.allocationSize(value.effectiveScope) + FfiConverterBool.allocationSize(value.desktopCaptureAuthorized) + FfiConverterBool.allocationSize(value.desktopUnlocked) + FfiConverterOptionalTypeEscalationReason.allocationSize(value.escalationReason) + FfiConverterOptionalString.allocationSize(value.escalationDetail);
    }
  }
  ;
  return new FFIConverter();
})();
var SetAgentCursorEnabledInput = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeSetAgentCursorEnabledInput = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        session: FfiConverterString.read(from),
        enabled: FfiConverterBool.read(from)
      };
    }
    write(value, into) {
      FfiConverterString.write(value.session, into);
      FfiConverterBool.write(value.enabled, into);
    }
    allocationSize(value) {
      return FfiConverterString.allocationSize(value.session) + FfiConverterBool.allocationSize(value.enabled);
    }
  }
  ;
  return new FFIConverter();
})();
var SetAgentCursorEnabledOutput = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeSetAgentCursorEnabledOutput = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        session: FfiConverterString.read(from),
        enabled: FfiConverterBool.read(from)
      };
    }
    write(value, into) {
      FfiConverterString.write(value.session, into);
      FfiConverterBool.write(value.enabled, into);
    }
    allocationSize(value) {
      return FfiConverterString.allocationSize(value.session) + FfiConverterBool.allocationSize(value.enabled);
    }
  }
  ;
  return new FFIConverter();
})();
var SetAgentCursorMotionInput = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeSetAgentCursorMotionInput = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        session: FfiConverterString.read(from),
        startHandle: FfiConverterOptionalFloat64.read(from),
        endHandle: FfiConverterOptionalFloat64.read(from),
        arcSize: FfiConverterOptionalFloat64.read(from),
        arcFlow: FfiConverterOptionalFloat64.read(from),
        spring: FfiConverterOptionalFloat64.read(from),
        glideDurationMs: FfiConverterOptionalFloat64.read(from),
        dwellAfterClickMs: FfiConverterOptionalFloat64.read(from),
        idleHideMs: FfiConverterOptionalFloat64.read(from),
        turnRadius: FfiConverterOptionalFloat64.read(from)
      };
    }
    write(value, into) {
      FfiConverterString.write(value.session, into);
      FfiConverterOptionalFloat64.write(value.startHandle, into);
      FfiConverterOptionalFloat64.write(value.endHandle, into);
      FfiConverterOptionalFloat64.write(value.arcSize, into);
      FfiConverterOptionalFloat64.write(value.arcFlow, into);
      FfiConverterOptionalFloat64.write(value.spring, into);
      FfiConverterOptionalFloat64.write(value.glideDurationMs, into);
      FfiConverterOptionalFloat64.write(value.dwellAfterClickMs, into);
      FfiConverterOptionalFloat64.write(value.idleHideMs, into);
      FfiConverterOptionalFloat64.write(value.turnRadius, into);
    }
    allocationSize(value) {
      return FfiConverterString.allocationSize(value.session) + FfiConverterOptionalFloat64.allocationSize(value.startHandle) + FfiConverterOptionalFloat64.allocationSize(value.endHandle) + FfiConverterOptionalFloat64.allocationSize(value.arcSize) + FfiConverterOptionalFloat64.allocationSize(value.arcFlow) + FfiConverterOptionalFloat64.allocationSize(value.spring) + FfiConverterOptionalFloat64.allocationSize(value.glideDurationMs) + FfiConverterOptionalFloat64.allocationSize(value.dwellAfterClickMs) + FfiConverterOptionalFloat64.allocationSize(value.idleHideMs) + FfiConverterOptionalFloat64.allocationSize(value.turnRadius);
    }
  }
  ;
  return new FFIConverter();
})();
var SetAgentCursorMotionOutput = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeSetAgentCursorMotionOutput = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        session: FfiConverterString.read(from),
        motion: FfiConverterTypeCursorMotionOutput.read(from)
      };
    }
    write(value, into) {
      FfiConverterString.write(value.session, into);
      FfiConverterTypeCursorMotionOutput.write(value.motion, into);
    }
    allocationSize(value) {
      return FfiConverterString.allocationSize(value.session) + FfiConverterTypeCursorMotionOutput.allocationSize(value.motion);
    }
  }
  ;
  return new FFIConverter();
})();
var SetAgentCursorThemeInput = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeSetAgentCursorThemeInput = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        session: FfiConverterString.read(from),
        themeId: FfiConverterString.read(from),
        reducedMotion: FfiConverterTypeCursorReducedMotion.read(from)
      };
    }
    write(value, into) {
      FfiConverterString.write(value.session, into);
      FfiConverterString.write(value.themeId, into);
      FfiConverterTypeCursorReducedMotion.write(value.reducedMotion, into);
    }
    allocationSize(value) {
      return FfiConverterString.allocationSize(value.session) + FfiConverterString.allocationSize(value.themeId) + FfiConverterTypeCursorReducedMotion.allocationSize(value.reducedMotion);
    }
  }
  ;
  return new FFIConverter();
})();
var SetAgentCursorThemeOutput = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeSetAgentCursorThemeOutput = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        session: FfiConverterString.read(from),
        theme: FfiConverterTypeCursorThemeOutput.read(from)
      };
    }
    write(value, into) {
      FfiConverterString.write(value.session, into);
      FfiConverterTypeCursorThemeOutput.write(value.theme, into);
    }
    allocationSize(value) {
      return FfiConverterString.allocationSize(value.session) + FfiConverterTypeCursorThemeOutput.allocationSize(value.theme);
    }
  }
  ;
  return new FFIConverter();
})();
var SetWindowFrameInput = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeSetWindowFrameInput = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        pid: FfiConverterUInt32.read(from),
        windowId: FfiConverterUInt64.read(from),
        x: FfiConverterFloat64.read(from),
        y: FfiConverterFloat64.read(from),
        width: FfiConverterFloat64.read(from),
        height: FfiConverterFloat64.read(from),
        session: FfiConverterOptionalString.read(from)
      };
    }
    write(value, into) {
      FfiConverterUInt32.write(value.pid, into);
      FfiConverterUInt64.write(value.windowId, into);
      FfiConverterFloat64.write(value.x, into);
      FfiConverterFloat64.write(value.y, into);
      FfiConverterFloat64.write(value.width, into);
      FfiConverterFloat64.write(value.height, into);
      FfiConverterOptionalString.write(value.session, into);
    }
    allocationSize(value) {
      return FfiConverterUInt32.allocationSize(value.pid) + FfiConverterUInt64.allocationSize(value.windowId) + FfiConverterFloat64.allocationSize(value.x) + FfiConverterFloat64.allocationSize(value.y) + FfiConverterFloat64.allocationSize(value.width) + FfiConverterFloat64.allocationSize(value.height) + FfiConverterOptionalString.allocationSize(value.session);
    }
  }
  ;
  return new FFIConverter();
})();
var SnapshotImage = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeSnapshotImage = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        mimeType: FfiConverterString.read(from),
        dataBase64: FfiConverterString.read(from)
      };
    }
    write(value, into) {
      FfiConverterString.write(value.mimeType, into);
      FfiConverterString.write(value.dataBase64, into);
    }
    allocationSize(value) {
      return FfiConverterString.allocationSize(value.mimeType) + FfiConverterString.allocationSize(value.dataBase64);
    }
  }
  ;
  return new FFIConverter();
})();
var StartSessionInput = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeStartSessionInput = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        session: FfiConverterOptionalString.read(from),
        captureScope: FfiConverterOptionalTypeCaptureScope.read(from),
        cursorTheme: FfiConverterOptionalTypeCursorThemeSelection.read(from)
      };
    }
    write(value, into) {
      FfiConverterOptionalString.write(value.session, into);
      FfiConverterOptionalTypeCaptureScope.write(value.captureScope, into);
      FfiConverterOptionalTypeCursorThemeSelection.write(value.cursorTheme, into);
    }
    allocationSize(value) {
      return FfiConverterOptionalString.allocationSize(value.session) + FfiConverterOptionalTypeCaptureScope.allocationSize(value.captureScope) + FfiConverterOptionalTypeCursorThemeSelection.allocationSize(value.cursorTheme);
    }
  }
  ;
  return new FFIConverter();
})();
var StartSessionOutput = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeStartSessionOutput = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        state: FfiConverterTypeSessionStateOutput.read(from),
        active: FfiConverterBool.read(from),
        revived: FfiConverterBool.read(from)
      };
    }
    write(value, into) {
      FfiConverterTypeSessionStateOutput.write(value.state, into);
      FfiConverterBool.write(value.active, into);
      FfiConverterBool.write(value.revived, into);
    }
    allocationSize(value) {
      return FfiConverterTypeSessionStateOutput.allocationSize(value.state) + FfiConverterBool.allocationSize(value.active) + FfiConverterBool.allocationSize(value.revived);
    }
  }
  ;
  return new FFIConverter();
})();
var WindowPredicate = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeWindowPredicate = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        exists: FfiConverterOptionalBoolean.read(from),
        bounds: FfiConverterOptionalTypeBoundsExpectation.read(from)
      };
    }
    write(value, into) {
      FfiConverterOptionalBoolean.write(value.exists, into);
      FfiConverterOptionalTypeBoundsExpectation.write(value.bounds, into);
    }
    allocationSize(value) {
      return FfiConverterOptionalBoolean.allocationSize(value.exists) + FfiConverterOptionalTypeBoundsExpectation.allocationSize(value.bounds);
    }
  }
  ;
  return new FFIConverter();
})();
var StatePredicate = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeStatePredicate = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        window: FfiConverterOptionalTypeWindowPredicate.read(from),
        element: FfiConverterOptionalTypeElementPredicate.read(from)
      };
    }
    write(value, into) {
      FfiConverterOptionalTypeWindowPredicate.write(value.window, into);
      FfiConverterOptionalTypeElementPredicate.write(value.element, into);
    }
    allocationSize(value) {
      return FfiConverterOptionalTypeWindowPredicate.allocationSize(value.window) + FfiConverterOptionalTypeElementPredicate.allocationSize(value.element);
    }
  }
  ;
  return new FFIConverter();
})();
var TypeTextInput = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeTypeTextInput = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        text: FfiConverterString.read(from),
        target: FfiConverterOptionalTypeActionTarget.read(from),
        scope: FfiConverterOptionalTypeDesktopScope.read(from),
        session: FfiConverterOptionalString.read(from)
      };
    }
    write(value, into) {
      FfiConverterString.write(value.text, into);
      FfiConverterOptionalTypeActionTarget.write(value.target, into);
      FfiConverterOptionalTypeDesktopScope.write(value.scope, into);
      FfiConverterOptionalString.write(value.session, into);
    }
    allocationSize(value) {
      return FfiConverterString.allocationSize(value.text) + FfiConverterOptionalTypeActionTarget.allocationSize(value.target) + FfiConverterOptionalTypeDesktopScope.allocationSize(value.scope) + FfiConverterOptionalString.allocationSize(value.session);
    }
  }
  ;
  return new FFIConverter();
})();
var VerifyStateInput = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeVerifyStateInput = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        pid: FfiConverterInt64.read(from),
        windowId: FfiConverterUInt64.read(from),
        expect: FfiConverterSequenceTypeStatePredicate.read(from),
        session: FfiConverterOptionalString.read(from),
        timeoutMs: FfiConverterOptionalUInt64.read(from),
        stableSamples: FfiConverterOptionalUInt64.read(from),
        includeScreenshot: FfiConverterOptionalBoolean.read(from)
      };
    }
    write(value, into) {
      FfiConverterInt64.write(value.pid, into);
      FfiConverterUInt64.write(value.windowId, into);
      FfiConverterSequenceTypeStatePredicate.write(value.expect, into);
      FfiConverterOptionalString.write(value.session, into);
      FfiConverterOptionalUInt64.write(value.timeoutMs, into);
      FfiConverterOptionalUInt64.write(value.stableSamples, into);
      FfiConverterOptionalBoolean.write(value.includeScreenshot, into);
    }
    allocationSize(value) {
      return FfiConverterInt64.allocationSize(value.pid) + FfiConverterUInt64.allocationSize(value.windowId) + FfiConverterSequenceTypeStatePredicate.allocationSize(value.expect) + FfiConverterOptionalString.allocationSize(value.session) + FfiConverterOptionalUInt64.allocationSize(value.timeoutMs) + FfiConverterOptionalUInt64.allocationSize(value.stableSamples) + FfiConverterOptionalBoolean.allocationSize(value.includeScreenshot);
    }
  }
  ;
  return new FFIConverter();
})();
var VerifyStateOutput = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeVerifyStateOutput = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        status: FfiConverterTypeVerificationStatus.read(from),
        stable: FfiConverterBool.read(from),
        elapsedMs: FfiConverterUInt64.read(from),
        samples: FfiConverterUInt64.read(from),
        predicates: FfiConverterSequenceTypePredicateOutcome.read(from)
      };
    }
    write(value, into) {
      FfiConverterTypeVerificationStatus.write(value.status, into);
      FfiConverterBool.write(value.stable, into);
      FfiConverterUInt64.write(value.elapsedMs, into);
      FfiConverterUInt64.write(value.samples, into);
      FfiConverterSequenceTypePredicateOutcome.write(value.predicates, into);
    }
    allocationSize(value) {
      return FfiConverterTypeVerificationStatus.allocationSize(value.status) + FfiConverterBool.allocationSize(value.stable) + FfiConverterUInt64.allocationSize(value.elapsedMs) + FfiConverterUInt64.allocationSize(value.samples) + FfiConverterSequenceTypePredicateOutcome.allocationSize(value.predicates);
    }
  }
  ;
  return new FFIConverter();
})();
var WindowElement = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeWindowElement = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        elementIndex: FfiConverterUInt64.read(from),
        role: FfiConverterString.read(from),
        depth: FfiConverterUInt32.read(from),
        elementToken: FfiConverterOptionalString.read(from),
        label: FfiConverterOptionalString.read(from),
        value: FfiConverterOptionalString.read(from),
        valueDescription: FfiConverterOptionalString.read(from),
        enabled: FfiConverterOptionalBoolean.read(from),
        selected: FfiConverterOptionalBoolean.read(from),
        inWebContent: FfiConverterOptionalBoolean.read(from),
        actions: FfiConverterOptionalSequenceString.read(from),
        parentIndex: FfiConverterOptionalUInt64.read(from),
        frame: FfiConverterOptionalTypeElementFrame.read(from),
        min: FfiConverterOptionalFloat64.read(from),
        max: FfiConverterOptionalFloat64.read(from)
      };
    }
    write(value, into) {
      FfiConverterUInt64.write(value.elementIndex, into);
      FfiConverterString.write(value.role, into);
      FfiConverterUInt32.write(value.depth, into);
      FfiConverterOptionalString.write(value.elementToken, into);
      FfiConverterOptionalString.write(value.label, into);
      FfiConverterOptionalString.write(value.value, into);
      FfiConverterOptionalString.write(value.valueDescription, into);
      FfiConverterOptionalBoolean.write(value.enabled, into);
      FfiConverterOptionalBoolean.write(value.selected, into);
      FfiConverterOptionalBoolean.write(value.inWebContent, into);
      FfiConverterOptionalSequenceString.write(value.actions, into);
      FfiConverterOptionalUInt64.write(value.parentIndex, into);
      FfiConverterOptionalTypeElementFrame.write(value.frame, into);
      FfiConverterOptionalFloat64.write(value.min, into);
      FfiConverterOptionalFloat64.write(value.max, into);
    }
    allocationSize(value) {
      return FfiConverterUInt64.allocationSize(value.elementIndex) + FfiConverterString.allocationSize(value.role) + FfiConverterUInt32.allocationSize(value.depth) + FfiConverterOptionalString.allocationSize(value.elementToken) + FfiConverterOptionalString.allocationSize(value.label) + FfiConverterOptionalString.allocationSize(value.value) + FfiConverterOptionalString.allocationSize(value.valueDescription) + FfiConverterOptionalBoolean.allocationSize(value.enabled) + FfiConverterOptionalBoolean.allocationSize(value.selected) + FfiConverterOptionalBoolean.allocationSize(value.inWebContent) + FfiConverterOptionalSequenceString.allocationSize(value.actions) + FfiConverterOptionalUInt64.allocationSize(value.parentIndex) + FfiConverterOptionalTypeElementFrame.allocationSize(value.frame) + FfiConverterOptionalFloat64.allocationSize(value.min) + FfiConverterOptionalFloat64.allocationSize(value.max);
    }
  }
  ;
  return new FFIConverter();
})();
var WindowStateOutput = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeWindowStateOutput = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        pid: FfiConverterUInt32.read(from),
        windowId: FfiConverterUInt64.read(from),
        snapshotId: FfiConverterOptionalString.read(from),
        appName: FfiConverterOptionalString.read(from),
        windowTitle: FfiConverterOptionalString.read(from),
        treeMarkdown: FfiConverterOptionalString.read(from),
        elements: FfiConverterOptionalSequenceTypeWindowElement.read(from),
        elementCount: FfiConverterOptionalUInt64.read(from),
        totalElementCount: FfiConverterOptionalUInt64.read(from),
        returnedElementCount: FfiConverterOptionalUInt64.read(from),
        filteredElementCount: FfiConverterOptionalUInt64.read(from),
        elementsComplete: FfiConverterOptionalBoolean.read(from),
        degraded: FfiConverterOptionalBoolean.read(from),
        degradedReason: FfiConverterOptionalString.read(from),
        truncated: FfiConverterOptionalBoolean.read(from),
        truncationReason: FfiConverterOptionalString.read(from),
        screenshotWidth: FfiConverterOptionalUInt32.read(from),
        screenshotHeight: FfiConverterOptionalUInt32.read(from),
        screenshotScale: FfiConverterOptionalFloat64.read(from),
        screenshotMimeType: FfiConverterOptionalString.read(from),
        screenshotFilePath: FfiConverterOptionalString.read(from),
        screenshotFrameValid: FfiConverterOptionalBoolean.read(from),
        windowBounds: FfiConverterOptionalTypeWindowBounds.read(from),
        images: FfiConverterSequenceTypeSnapshotImage.read(from)
      };
    }
    write(value, into) {
      FfiConverterUInt32.write(value.pid, into);
      FfiConverterUInt64.write(value.windowId, into);
      FfiConverterOptionalString.write(value.snapshotId, into);
      FfiConverterOptionalString.write(value.appName, into);
      FfiConverterOptionalString.write(value.windowTitle, into);
      FfiConverterOptionalString.write(value.treeMarkdown, into);
      FfiConverterOptionalSequenceTypeWindowElement.write(value.elements, into);
      FfiConverterOptionalUInt64.write(value.elementCount, into);
      FfiConverterOptionalUInt64.write(value.totalElementCount, into);
      FfiConverterOptionalUInt64.write(value.returnedElementCount, into);
      FfiConverterOptionalUInt64.write(value.filteredElementCount, into);
      FfiConverterOptionalBoolean.write(value.elementsComplete, into);
      FfiConverterOptionalBoolean.write(value.degraded, into);
      FfiConverterOptionalString.write(value.degradedReason, into);
      FfiConverterOptionalBoolean.write(value.truncated, into);
      FfiConverterOptionalString.write(value.truncationReason, into);
      FfiConverterOptionalUInt32.write(value.screenshotWidth, into);
      FfiConverterOptionalUInt32.write(value.screenshotHeight, into);
      FfiConverterOptionalFloat64.write(value.screenshotScale, into);
      FfiConverterOptionalString.write(value.screenshotMimeType, into);
      FfiConverterOptionalString.write(value.screenshotFilePath, into);
      FfiConverterOptionalBoolean.write(value.screenshotFrameValid, into);
      FfiConverterOptionalTypeWindowBounds.write(value.windowBounds, into);
      FfiConverterSequenceTypeSnapshotImage.write(value.images, into);
    }
    allocationSize(value) {
      return FfiConverterUInt32.allocationSize(value.pid) + FfiConverterUInt64.allocationSize(value.windowId) + FfiConverterOptionalString.allocationSize(value.snapshotId) + FfiConverterOptionalString.allocationSize(value.appName) + FfiConverterOptionalString.allocationSize(value.windowTitle) + FfiConverterOptionalString.allocationSize(value.treeMarkdown) + FfiConverterOptionalSequenceTypeWindowElement.allocationSize(value.elements) + FfiConverterOptionalUInt64.allocationSize(value.elementCount) + FfiConverterOptionalUInt64.allocationSize(value.totalElementCount) + FfiConverterOptionalUInt64.allocationSize(value.returnedElementCount) + FfiConverterOptionalUInt64.allocationSize(value.filteredElementCount) + FfiConverterOptionalBoolean.allocationSize(value.elementsComplete) + FfiConverterOptionalBoolean.allocationSize(value.degraded) + FfiConverterOptionalString.allocationSize(value.degradedReason) + FfiConverterOptionalBoolean.allocationSize(value.truncated) + FfiConverterOptionalString.allocationSize(value.truncationReason) + FfiConverterOptionalUInt32.allocationSize(value.screenshotWidth) + FfiConverterOptionalUInt32.allocationSize(value.screenshotHeight) + FfiConverterOptionalFloat64.allocationSize(value.screenshotScale) + FfiConverterOptionalString.allocationSize(value.screenshotMimeType) + FfiConverterOptionalString.allocationSize(value.screenshotFilePath) + FfiConverterOptionalBoolean.allocationSize(value.screenshotFrameValid) + FfiConverterOptionalTypeWindowBounds.allocationSize(value.windowBounds) + FfiConverterSequenceTypeSnapshotImage.allocationSize(value.images);
    }
  }
  ;
  return new FFIConverter();
})();
var Platform;
(function(Platform2) {
  Platform2[Platform2["Macos"] = 0] = "Macos";
  Platform2[Platform2["Windows"] = 1] = "Windows";
  Platform2[Platform2["Linux"] = 2] = "Linux";
})(Platform || (Platform = {}));
var FfiConverterTypePlatform = (() => {
  const ordinalConverter = FfiConverterInt32;
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      switch (ordinalConverter.read(from)) {
        case 1:
          return Platform.Macos;
        case 2:
          return Platform.Windows;
        case 3:
          return Platform.Linux;
        default:
          throw new UniffiInternalError.UnexpectedEnumCase();
      }
    }
    write(value, into) {
      switch (value) {
        case Platform.Macos:
          return ordinalConverter.write(1, into);
        case Platform.Windows:
          return ordinalConverter.write(2, into);
        case Platform.Linux:
          return ordinalConverter.write(3, into);
      }
    }
    allocationSize(value) {
      return ordinalConverter.allocationSize(0);
    }
  }
  return new FFIConverter();
})();
var FfiConverterOptionalUInt32 = new FfiConverterOptional(FfiConverterUInt32);
var FfiConverterOptionalTypeActionDelivery = new FfiConverterOptional(FfiConverterTypeActionDelivery);
var FfiConverterSequenceTypeActionEvidence = new FfiConverterArray(FfiConverterTypeActionEvidence);
var FfiConverterOptionalSequenceTypeActionEvidence = new FfiConverterOptional(FfiConverterSequenceTypeActionEvidence);
var FfiConverterOptionalTypeActionEscalation = new FfiConverterOptional(FfiConverterTypeActionEscalation);
var FfiConverterOptionalString = new FfiConverterOptional(FfiConverterString);
var FfiConverterOptionalFloat64 = new FfiConverterOptional(FfiConverterFloat64);
var FfiConverterOptionalTypeClickButton = new FfiConverterOptional(FfiConverterTypeClickButton);
var FfiConverterSequenceString = new FfiConverterArray(FfiConverterString);
var FfiConverterOptionalTypeActionTarget = new FfiConverterOptional(FfiConverterTypeActionTarget);
var FfiConverterOptionalTypeDesktopScope = new FfiConverterOptional(FfiConverterTypeDesktopScope);
var FfiConverterOptionalUInt64 = new FfiConverterOptional(FfiConverterUInt64);
var FfiConverterOptionalSequenceString = new FfiConverterOptional(FfiConverterSequenceString);
var FfiConverterOptionalBoolean = new FfiConverterOptional(FfiConverterBool);
var FfiConverterOptionalTypeCursorPointOutput = new FfiConverterOptional(FfiConverterTypeCursorPointOutput);
var FfiConverterSequenceTypeAppInfo = new FfiConverterArray(FfiConverterTypeAppInfo);
var FfiConverterSequenceTypeSessionOutput = new FfiConverterArray(FfiConverterTypeSessionOutput);
var FfiConverterOptionalInt64 = new FfiConverterOptional(FfiConverterInt64);
var FfiConverterOptionalInt32 = new FfiConverterOptional(FfiConverterInt32);
var FfiConverterSequenceUInt64 = new FfiConverterArray(FfiConverterUInt64);
var FfiConverterOptionalSequenceUInt64 = new FfiConverterOptional(FfiConverterSequenceUInt64);
var FfiConverterSequenceTypeWindowInfo = new FfiConverterArray(FfiConverterTypeWindowInfo);
var FfiConverterOptionalTypeUnknownReason = new FfiConverterOptional(FfiConverterTypeUnknownReason);
var FfiConverterOptionalTypeScrollBy = new FfiConverterOptional(FfiConverterTypeScrollBy);
var FfiConverterOptionalTypeEscalationReason = new FfiConverterOptional(FfiConverterTypeEscalationReason);
var FfiConverterOptionalTypeCaptureScope = new FfiConverterOptional(FfiConverterTypeCaptureScope);
var FfiConverterOptionalTypeCursorThemeSelection = new FfiConverterOptional(FfiConverterTypeCursorThemeSelection);
var FfiConverterOptionalTypeBoundsExpectation = new FfiConverterOptional(FfiConverterTypeBoundsExpectation);
var FfiConverterOptionalTypeWindowPredicate = new FfiConverterOptional(FfiConverterTypeWindowPredicate);
var FfiConverterOptionalTypeElementPredicate = new FfiConverterOptional(FfiConverterTypeElementPredicate);
var FfiConverterSequenceTypeStatePredicate = new FfiConverterArray(FfiConverterTypeStatePredicate);
var FfiConverterSequenceTypePredicateOutcome = new FfiConverterArray(FfiConverterTypePredicateOutcome);
var FfiConverterOptionalTypeElementFrame = new FfiConverterOptional(FfiConverterTypeElementFrame);
var FfiConverterSequenceTypeWindowElement = new FfiConverterArray(FfiConverterTypeWindowElement);
var FfiConverterOptionalSequenceTypeWindowElement = new FfiConverterOptional(FfiConverterSequenceTypeWindowElement);
var FfiConverterOptionalTypeWindowBounds = new FfiConverterOptional(FfiConverterTypeWindowBounds);
var FfiConverterSequenceTypeSnapshotImage = new FfiConverterArray(FfiConverterTypeSnapshotImage);
function uniffiEnsureInitialized() {
  const bindingsContractVersion = 30;
  const scaffoldingContractVersion = cua_driver_contract_ffi_default().ffi_cua_driver_contract_uniffi_contract_version();
  if (bindingsContractVersion !== scaffoldingContractVersion) {
    throw new UniffiInternalError.ContractVersionMismatch(scaffoldingContractVersion, bindingsContractVersion);
  }
}
var cua_driver_contract_default = Object.freeze({
  initialize: uniffiEnsureInitialized,
  converters: {
    FfiConverterTypeActionDelivery,
    FfiConverterTypeActionDeliveryMode,
    FfiConverterTypeActionEffect,
    FfiConverterTypeActionEscalation,
    FfiConverterTypeActionEscalationReason,
    FfiConverterTypeActionEscalationTarget,
    FfiConverterTypeActionEvidence,
    FfiConverterTypeActionEvidenceKind,
    FfiConverterTypeActionResult,
    FfiConverterTypeActionRoute,
    FfiConverterTypeActionTarget,
    FfiConverterTypeAppInfo,
    FfiConverterTypeBoundsExpectation,
    FfiConverterTypeCaptureScope,
    FfiConverterTypeClickButton,
    FfiConverterTypeClickInput,
    FfiConverterTypeClickPosition,
    FfiConverterTypeClipboardReadInput,
    FfiConverterTypeClipboardReadOutput,
    FfiConverterTypeClipboardWriteInput,
    FfiConverterTypeClipboardWriteOutput,
    FfiConverterTypeCursorAction,
    FfiConverterTypeCursorMotionOutput,
    FfiConverterTypeCursorPointOutput,
    FfiConverterTypeCursorReducedMotion,
    FfiConverterTypeCursorThemeOutput,
    FfiConverterTypeCursorThemeSelection,
    FfiConverterTypeCursorVisualOutput,
    FfiConverterTypeDesktopScope,
    FfiConverterTypeDragInput,
    FfiConverterTypeEffectiveScope,
    FfiConverterTypeElementFrame,
    FfiConverterTypeElementPredicate,
    FfiConverterTypeElementSelector,
    FfiConverterTypeEndSessionInput,
    FfiConverterTypeEndSessionOutput,
    FfiConverterTypeEscalateSessionInput,
    FfiConverterTypeEscalationReason,
    FfiConverterTypeGetAgentCursorStateInput,
    FfiConverterTypeGetAgentCursorStateOutput,
    FfiConverterTypeGetCursorPositionInput,
    FfiConverterTypeGetDesktopStateInput,
    FfiConverterTypeGetScreenSizeInput,
    FfiConverterTypeGetSessionInput,
    FfiConverterTypeGetSessionStateInput,
    FfiConverterTypeGetWindowStateInput,
    FfiConverterTypeHotkeyInput,
    FfiConverterTypeInputDeliveryMode,
    FfiConverterTypeInvokeMenuInput,
    FfiConverterTypeListAppsInput,
    FfiConverterTypeListAppsOutput,
    FfiConverterTypeListSessionsInput,
    FfiConverterTypeListSessionsOutput,
    FfiConverterTypeListWindowsInput,
    FfiConverterTypeListWindowsOutput,
    FfiConverterTypeMoveCursorInput,
    FfiConverterTypePlatform,
    FfiConverterTypePredicateOutcome,
    FfiConverterTypePressKeyInput,
    FfiConverterTypeScrollBy,
    FfiConverterTypeScrollDirection,
    FfiConverterTypeScrollInput,
    FfiConverterTypeSessionClientKindOutput,
    FfiConverterTypeSessionLifecycleState,
    FfiConverterTypeSessionOutput,
    FfiConverterTypeSessionStateOutput,
    FfiConverterTypeSessionTransportOutput,
    FfiConverterTypeSetAgentCursorEnabledInput,
    FfiConverterTypeSetAgentCursorEnabledOutput,
    FfiConverterTypeSetAgentCursorMotionInput,
    FfiConverterTypeSetAgentCursorMotionOutput,
    FfiConverterTypeSetAgentCursorThemeInput,
    FfiConverterTypeSetAgentCursorThemeOutput,
    FfiConverterTypeSetWindowFrameInput,
    FfiConverterTypeSnapshotImage,
    FfiConverterTypeStartSessionInput,
    FfiConverterTypeStartSessionOutput,
    FfiConverterTypeStatePredicate,
    FfiConverterTypeTypeTextInput,
    FfiConverterTypeUnknownReason,
    FfiConverterTypeVerificationStatus,
    FfiConverterTypeVerifyStateInput,
    FfiConverterTypeVerifyStateOutput,
    FfiConverterTypeWindowBounds,
    FfiConverterTypeWindowElement,
    FfiConverterTypeWindowInfo,
    FfiConverterTypeWindowPredicate,
    FfiConverterTypeWindowStateOutput
  }
});

// node_modules/.pnpm/@trycua+cua-driver@0.28.2/node_modules/@trycua/cua-driver/dist/native/cua_driver_sdk.js
var { FfiConverterTypeActionResult: FfiConverterTypeActionResult2, FfiConverterTypeClickInput: FfiConverterTypeClickInput2, FfiConverterTypeClipboardReadInput: FfiConverterTypeClipboardReadInput2, FfiConverterTypeClipboardWriteInput: FfiConverterTypeClipboardWriteInput2, FfiConverterTypeDragInput: FfiConverterTypeDragInput2, FfiConverterTypeEndSessionInput: FfiConverterTypeEndSessionInput2, FfiConverterTypeEndSessionOutput: FfiConverterTypeEndSessionOutput2, FfiConverterTypeEscalateSessionInput: FfiConverterTypeEscalateSessionInput2, FfiConverterTypeGetAgentCursorStateInput: FfiConverterTypeGetAgentCursorStateInput2, FfiConverterTypeGetCursorPositionInput: FfiConverterTypeGetCursorPositionInput2, FfiConverterTypeGetDesktopStateInput: FfiConverterTypeGetDesktopStateInput2, FfiConverterTypeGetScreenSizeInput: FfiConverterTypeGetScreenSizeInput2, FfiConverterTypeGetSessionInput: FfiConverterTypeGetSessionInput2, FfiConverterTypeGetSessionStateInput: FfiConverterTypeGetSessionStateInput2, FfiConverterTypeGetWindowStateInput: FfiConverterTypeGetWindowStateInput2, FfiConverterTypeHotkeyInput: FfiConverterTypeHotkeyInput2, FfiConverterTypeInvokeMenuInput: FfiConverterTypeInvokeMenuInput2, FfiConverterTypeListAppsInput: FfiConverterTypeListAppsInput2, FfiConverterTypeListAppsOutput: FfiConverterTypeListAppsOutput2, FfiConverterTypeListSessionsInput: FfiConverterTypeListSessionsInput2, FfiConverterTypeListSessionsOutput: FfiConverterTypeListSessionsOutput2, FfiConverterTypeListWindowsInput: FfiConverterTypeListWindowsInput2, FfiConverterTypeListWindowsOutput: FfiConverterTypeListWindowsOutput2, FfiConverterTypeMoveCursorInput: FfiConverterTypeMoveCursorInput2, FfiConverterTypePressKeyInput: FfiConverterTypePressKeyInput2, FfiConverterTypeScrollInput: FfiConverterTypeScrollInput2, FfiConverterTypeSessionOutput: FfiConverterTypeSessionOutput2, FfiConverterTypeSessionStateOutput: FfiConverterTypeSessionStateOutput2, FfiConverterTypeSetAgentCursorEnabledInput: FfiConverterTypeSetAgentCursorEnabledInput2, FfiConverterTypeSetAgentCursorMotionInput: FfiConverterTypeSetAgentCursorMotionInput2, FfiConverterTypeSetAgentCursorThemeInput: FfiConverterTypeSetAgentCursorThemeInput2, FfiConverterTypeSetWindowFrameInput: FfiConverterTypeSetWindowFrameInput2, FfiConverterTypeStartSessionInput: FfiConverterTypeStartSessionInput2, FfiConverterTypeStartSessionOutput: FfiConverterTypeStartSessionOutput2, FfiConverterTypeTypeTextInput: FfiConverterTypeTypeTextInput2, FfiConverterTypeVerifyStateInput: FfiConverterTypeVerifyStateInput2, FfiConverterTypeVerifyStateOutput: FfiConverterTypeVerifyStateOutput2, FfiConverterTypeWindowStateOutput: FfiConverterTypeWindowStateOutput2 } = cua_driver_contract_default.converters;
var uniffiCaller2 = new UniffiRustCaller(() => ({ code: 0 }));
var uniffiIsDebug2 = (
  // @ts-ignore -- The process global might not be defined
  typeof process !== "object" || // @ts-ignore -- The process global might not be defined
  process?.env?.NODE_ENV !== "production" || false
);
var SessionPermissionMode;
(function(SessionPermissionMode2) {
  SessionPermissionMode2[SessionPermissionMode2["Standard"] = 0] = "Standard";
  SessionPermissionMode2[SessionPermissionMode2["Bounded"] = 1] = "Bounded";
  SessionPermissionMode2[SessionPermissionMode2["Unrestricted"] = 2] = "Unrestricted";
})(SessionPermissionMode || (SessionPermissionMode = {}));
var FfiConverterTypeSessionPermissionMode = (() => {
  const ordinalConverter = FfiConverterInt32;
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      switch (ordinalConverter.read(from)) {
        case 1:
          return SessionPermissionMode.Standard;
        case 2:
          return SessionPermissionMode.Bounded;
        case 3:
          return SessionPermissionMode.Unrestricted;
        default:
          throw new UniffiInternalError.UnexpectedEnumCase();
      }
    }
    write(value, into) {
      switch (value) {
        case SessionPermissionMode.Standard:
          return ordinalConverter.write(1, into);
        case SessionPermissionMode.Bounded:
          return ordinalConverter.write(2, into);
        case SessionPermissionMode.Unrestricted:
          return ordinalConverter.write(3, into);
      }
    }
    allocationSize(value) {
      return ordinalConverter.allocationSize(0);
    }
  }
  return new FFIConverter();
})();
var stringConverter2 = (() => {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  return {
    stringToBytes: (s) => encoder.encode(s),
    bytesToString: (ab) => decoder.decode(ab),
    stringByteLength: (s) => encoder.encode(s).byteLength,
    writeStringIntoBuffer: (s, buf, offset) => {
      const view = new Uint8Array(buf.arrayBuffer, offset, buf.arrayBuffer.byteLength - offset);
      return encoder.encodeInto(s, view).written;
    },
    readStringFromBuffer: (buf, offset, length) => decoder.decode(new Uint8Array(buf.arrayBuffer, offset, length))
  };
})();
var FfiConverterString2 = uniffiCreateFfiConverterString(stringConverter2);
var RuntimeAuthorizationOptions = (() => {
  const defaults = () => ({
    compatibilityCapabilityManifestPath: void 0
  });
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeRuntimeAuthorizationOptions = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        allowedModes: FfiConverterSequenceTypeSessionPermissionMode.read(from),
        compatibilityMode: FfiConverterTypeSessionPermissionMode.read(from),
        compatibilityCapabilityManifestPath: FfiConverterOptionalString2.read(from),
        compatibilityBoundedManifestPath: FfiConverterOptionalString2.read(from),
        unrestrictedAcknowledged: FfiConverterBool.read(from),
        maxSessionTtlSeconds: FfiConverterUInt64.read(from),
        maxIdleTtlSeconds: FfiConverterUInt64.read(from)
      };
    }
    write(value, into) {
      FfiConverterSequenceTypeSessionPermissionMode.write(value.allowedModes, into);
      FfiConverterTypeSessionPermissionMode.write(value.compatibilityMode, into);
      FfiConverterOptionalString2.write(value.compatibilityCapabilityManifestPath, into);
      FfiConverterOptionalString2.write(value.compatibilityBoundedManifestPath, into);
      FfiConverterBool.write(value.unrestrictedAcknowledged, into);
      FfiConverterUInt64.write(value.maxSessionTtlSeconds, into);
      FfiConverterUInt64.write(value.maxIdleTtlSeconds, into);
    }
    allocationSize(value) {
      return FfiConverterSequenceTypeSessionPermissionMode.allocationSize(value.allowedModes) + FfiConverterTypeSessionPermissionMode.allocationSize(value.compatibilityMode) + FfiConverterOptionalString2.allocationSize(value.compatibilityCapabilityManifestPath) + FfiConverterOptionalString2.allocationSize(value.compatibilityBoundedManifestPath) + FfiConverterBool.allocationSize(value.unrestrictedAcknowledged) + FfiConverterUInt64.allocationSize(value.maxSessionTtlSeconds) + FfiConverterUInt64.allocationSize(value.maxIdleTtlSeconds);
    }
  }
  ;
  return new FFIConverter();
})();
var ConfiguredDriverOptions = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeConfiguredDriverOptions = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        claudeCodeCompatibility: FfiConverterBool.read(from),
        authorization: FfiConverterTypeRuntimeAuthorizationOptions.read(from)
      };
    }
    write(value, into) {
      FfiConverterBool.write(value.claudeCodeCompatibility, into);
      FfiConverterTypeRuntimeAuthorizationOptions.write(value.authorization, into);
    }
    allocationSize(value) {
      return FfiConverterBool.allocationSize(value.claudeCodeCompatibility) + FfiConverterTypeRuntimeAuthorizationOptions.allocationSize(value.authorization);
    }
  }
  ;
  return new FFIConverter();
})();
var DriverActivityKind;
(function(DriverActivityKind2) {
  DriverActivityKind2[DriverActivityKind2["AuthorizedAction"] = 0] = "AuthorizedAction";
  DriverActivityKind2[DriverActivityKind2["AuthorizationRefused"] = 1] = "AuthorizationRefused";
  DriverActivityKind2[DriverActivityKind2["ActionFailed"] = 2] = "ActionFailed";
  DriverActivityKind2[DriverActivityKind2["GrantIssued"] = 3] = "GrantIssued";
  DriverActivityKind2[DriverActivityKind2["GrantRevoked"] = 4] = "GrantRevoked";
  DriverActivityKind2[DriverActivityKind2["SessionStarted"] = 5] = "SessionStarted";
  DriverActivityKind2[DriverActivityKind2["SessionEnded"] = 6] = "SessionEnded";
})(DriverActivityKind || (DriverActivityKind = {}));
var FfiConverterTypeDriverActivityKind = (() => {
  const ordinalConverter = FfiConverterInt32;
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      switch (ordinalConverter.read(from)) {
        case 1:
          return DriverActivityKind.AuthorizedAction;
        case 2:
          return DriverActivityKind.AuthorizationRefused;
        case 3:
          return DriverActivityKind.ActionFailed;
        case 4:
          return DriverActivityKind.GrantIssued;
        case 5:
          return DriverActivityKind.GrantRevoked;
        case 6:
          return DriverActivityKind.SessionStarted;
        case 7:
          return DriverActivityKind.SessionEnded;
        default:
          throw new UniffiInternalError.UnexpectedEnumCase();
      }
    }
    write(value, into) {
      switch (value) {
        case DriverActivityKind.AuthorizedAction:
          return ordinalConverter.write(1, into);
        case DriverActivityKind.AuthorizationRefused:
          return ordinalConverter.write(2, into);
        case DriverActivityKind.ActionFailed:
          return ordinalConverter.write(3, into);
        case DriverActivityKind.GrantIssued:
          return ordinalConverter.write(4, into);
        case DriverActivityKind.GrantRevoked:
          return ordinalConverter.write(5, into);
        case DriverActivityKind.SessionStarted:
          return ordinalConverter.write(6, into);
        case DriverActivityKind.SessionEnded:
          return ordinalConverter.write(7, into);
      }
    }
    allocationSize(value) {
      return ordinalConverter.allocationSize(0);
    }
  }
  return new FFIConverter();
})();
var DriverActivityEvent = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeDriverActivityEvent = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        kind: FfiConverterTypeDriverActivityKind.read(from),
        unixMs: FfiConverterUInt64.read(from),
        toolName: FfiConverterString2.read(from),
        adapterIds: FfiConverterSequenceString2.read(from),
        riskClass: FfiConverterString2.read(from),
        publicSession: FfiConverterOptionalString2.read(from),
        refusalCode: FfiConverterOptionalString2.read(from)
      };
    }
    write(value, into) {
      FfiConverterTypeDriverActivityKind.write(value.kind, into);
      FfiConverterUInt64.write(value.unixMs, into);
      FfiConverterString2.write(value.toolName, into);
      FfiConverterSequenceString2.write(value.adapterIds, into);
      FfiConverterString2.write(value.riskClass, into);
      FfiConverterOptionalString2.write(value.publicSession, into);
      FfiConverterOptionalString2.write(value.refusalCode, into);
    }
    allocationSize(value) {
      return FfiConverterTypeDriverActivityKind.allocationSize(value.kind) + FfiConverterUInt64.allocationSize(value.unixMs) + FfiConverterString2.allocationSize(value.toolName) + FfiConverterSequenceString2.allocationSize(value.adapterIds) + FfiConverterString2.allocationSize(value.riskClass) + FfiConverterOptionalString2.allocationSize(value.publicSession) + FfiConverterOptionalString2.allocationSize(value.refusalCode);
    }
  }
  ;
  return new FFIConverter();
})();
var DriverAuthorizationAction;
(function(DriverAuthorizationAction2) {
  DriverAuthorizationAction2[DriverAuthorizationAction2["Allow"] = 0] = "Allow";
  DriverAuthorizationAction2[DriverAuthorizationAction2["Deny"] = 1] = "Deny";
  DriverAuthorizationAction2[DriverAuthorizationAction2["Cancel"] = 2] = "Cancel";
})(DriverAuthorizationAction || (DriverAuthorizationAction = {}));
var FfiConverterTypeDriverAuthorizationAction = (() => {
  const ordinalConverter = FfiConverterInt32;
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      switch (ordinalConverter.read(from)) {
        case 1:
          return DriverAuthorizationAction.Allow;
        case 2:
          return DriverAuthorizationAction.Deny;
        case 3:
          return DriverAuthorizationAction.Cancel;
        default:
          throw new UniffiInternalError.UnexpectedEnumCase();
      }
    }
    write(value, into) {
      switch (value) {
        case DriverAuthorizationAction.Allow:
          return ordinalConverter.write(1, into);
        case DriverAuthorizationAction.Deny:
          return ordinalConverter.write(2, into);
        case DriverAuthorizationAction.Cancel:
          return ordinalConverter.write(3, into);
      }
    }
    allocationSize(value) {
      return ordinalConverter.allocationSize(0);
    }
  }
  return new FFIConverter();
})();
var DriverAuthorizationDecision = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeDriverAuthorizationDecision = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        action: FfiConverterTypeDriverAuthorizationAction.read(from),
        requestDigest: FfiConverterString2.read(from)
      };
    }
    write(value, into) {
      FfiConverterTypeDriverAuthorizationAction.write(value.action, into);
      FfiConverterString2.write(value.requestDigest, into);
    }
    allocationSize(value) {
      return FfiConverterTypeDriverAuthorizationAction.allocationSize(value.action) + FfiConverterString2.allocationSize(value.requestDigest);
    }
  }
  ;
  return new FFIConverter();
})();
var DriverAuthorizationRequest = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeDriverAuthorizationRequest = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        schema: FfiConverterString2.read(from),
        nonce: FfiConverterString2.read(from),
        generation: FfiConverterUInt64.read(from),
        daemonInstance: FfiConverterString2.read(from),
        permissionMode: FfiConverterString2.read(from),
        managedPolicySha256: FfiConverterOptionalString2.read(from),
        userPolicySha256: FfiConverterOptionalString2.read(from),
        adapterId: FfiConverterString2.read(from),
        riskClass: FfiConverterString2.read(from),
        publicSession: FfiConverterString2.read(from),
        transportSession: FfiConverterString2.read(from),
        resourceJson: FfiConverterString2.read(from),
        humanSummary: FfiConverterString2.read(from),
        expiresUnixMs: FfiConverterUInt64.read(from),
        requestDigest: FfiConverterString2.read(from)
      };
    }
    write(value, into) {
      FfiConverterString2.write(value.schema, into);
      FfiConverterString2.write(value.nonce, into);
      FfiConverterUInt64.write(value.generation, into);
      FfiConverterString2.write(value.daemonInstance, into);
      FfiConverterString2.write(value.permissionMode, into);
      FfiConverterOptionalString2.write(value.managedPolicySha256, into);
      FfiConverterOptionalString2.write(value.userPolicySha256, into);
      FfiConverterString2.write(value.adapterId, into);
      FfiConverterString2.write(value.riskClass, into);
      FfiConverterString2.write(value.publicSession, into);
      FfiConverterString2.write(value.transportSession, into);
      FfiConverterString2.write(value.resourceJson, into);
      FfiConverterString2.write(value.humanSummary, into);
      FfiConverterUInt64.write(value.expiresUnixMs, into);
      FfiConverterString2.write(value.requestDigest, into);
    }
    allocationSize(value) {
      return FfiConverterString2.allocationSize(value.schema) + FfiConverterString2.allocationSize(value.nonce) + FfiConverterUInt64.allocationSize(value.generation) + FfiConverterString2.allocationSize(value.daemonInstance) + FfiConverterString2.allocationSize(value.permissionMode) + FfiConverterOptionalString2.allocationSize(value.managedPolicySha256) + FfiConverterOptionalString2.allocationSize(value.userPolicySha256) + FfiConverterString2.allocationSize(value.adapterId) + FfiConverterString2.allocationSize(value.riskClass) + FfiConverterString2.allocationSize(value.publicSession) + FfiConverterString2.allocationSize(value.transportSession) + FfiConverterString2.allocationSize(value.resourceJson) + FfiConverterString2.allocationSize(value.humanSummary) + FfiConverterUInt64.allocationSize(value.expiresUnixMs) + FfiConverterString2.allocationSize(value.requestDigest);
    }
  }
  ;
  return new FFIConverter();
})();
var DriverMetadata = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeDriverMetadata = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        driverVersion: FfiConverterString2.read(from),
        contractVersion: FfiConverterString2.read(from),
        toolsListSchemaVersion: FfiConverterString2.read(from),
        capabilityVersion: FfiConverterString2.read(from),
        mcpProtocolVersion: FfiConverterString2.read(from),
        pid: FfiConverterUInt32.read(from),
        embedded: FfiConverterBool.read(from),
        hostBundleId: FfiConverterOptionalString2.read(from)
      };
    }
    write(value, into) {
      FfiConverterString2.write(value.driverVersion, into);
      FfiConverterString2.write(value.contractVersion, into);
      FfiConverterString2.write(value.toolsListSchemaVersion, into);
      FfiConverterString2.write(value.capabilityVersion, into);
      FfiConverterString2.write(value.mcpProtocolVersion, into);
      FfiConverterUInt32.write(value.pid, into);
      FfiConverterBool.write(value.embedded, into);
      FfiConverterOptionalString2.write(value.hostBundleId, into);
    }
    allocationSize(value) {
      return FfiConverterString2.allocationSize(value.driverVersion) + FfiConverterString2.allocationSize(value.contractVersion) + FfiConverterString2.allocationSize(value.toolsListSchemaVersion) + FfiConverterString2.allocationSize(value.capabilityVersion) + FfiConverterString2.allocationSize(value.mcpProtocolVersion) + FfiConverterUInt32.allocationSize(value.pid) + FfiConverterBool.allocationSize(value.embedded) + FfiConverterOptionalString2.allocationSize(value.hostBundleId);
    }
  }
  ;
  return new FFIConverter();
})();
var DriverOptions = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeDriverOptions = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        claudeCodeCompatibility: FfiConverterBool.read(from)
      };
    }
    write(value, into) {
      FfiConverterBool.write(value.claudeCodeCompatibility, into);
    }
    allocationSize(value) {
      return FfiConverterBool.allocationSize(value.claudeCodeCompatibility);
    }
  }
  ;
  return new FFIConverter();
})();
var DriverServiceHeader = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeDriverServiceHeader = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        name: FfiConverterString2.read(from),
        value: FfiConverterString2.read(from)
      };
    }
    write(value, into) {
      FfiConverterString2.write(value.name, into);
      FfiConverterString2.write(value.value, into);
    }
    allocationSize(value) {
      return FfiConverterString2.allocationSize(value.name) + FfiConverterString2.allocationSize(value.value);
    }
  }
  ;
  return new FFIConverter();
})();
var DriverServiceRequest = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeDriverServiceRequest = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        method: FfiConverterString2.read(from),
        path: FfiConverterString2.read(from),
        headers: FfiConverterSequenceTypeDriverServiceHeader.read(from),
        body: FfiConverterArrayBuffer.read(from),
        timeoutMs: FfiConverterUInt64.read(from)
      };
    }
    write(value, into) {
      FfiConverterString2.write(value.method, into);
      FfiConverterString2.write(value.path, into);
      FfiConverterSequenceTypeDriverServiceHeader.write(value.headers, into);
      FfiConverterArrayBuffer.write(value.body, into);
      FfiConverterUInt64.write(value.timeoutMs, into);
    }
    allocationSize(value) {
      return FfiConverterString2.allocationSize(value.method) + FfiConverterString2.allocationSize(value.path) + FfiConverterSequenceTypeDriverServiceHeader.allocationSize(value.headers) + FfiConverterArrayBuffer.allocationSize(value.body) + FfiConverterUInt64.allocationSize(value.timeoutMs);
    }
  }
  ;
  return new FFIConverter();
})();
var DriverServiceResponse = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeDriverServiceResponse = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        status: FfiConverterUInt16.read(from),
        headers: FfiConverterSequenceTypeDriverServiceHeader.read(from),
        body: FfiConverterArrayBuffer.read(from)
      };
    }
    write(value, into) {
      FfiConverterUInt16.write(value.status, into);
      FfiConverterSequenceTypeDriverServiceHeader.write(value.headers, into);
      FfiConverterArrayBuffer.write(value.body, into);
    }
    allocationSize(value) {
      return FfiConverterUInt16.allocationSize(value.status) + FfiConverterSequenceTypeDriverServiceHeader.allocationSize(value.headers) + FfiConverterArrayBuffer.allocationSize(value.body);
    }
  }
  ;
  return new FFIConverter();
})();
var EmbeddedEnvironmentVariable = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeEmbeddedEnvironmentVariable = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        name: FfiConverterString2.read(from),
        value: FfiConverterString2.read(from)
      };
    }
    write(value, into) {
      FfiConverterString2.write(value.name, into);
      FfiConverterString2.write(value.value, into);
    }
    allocationSize(value) {
      return FfiConverterString2.allocationSize(value.name) + FfiConverterString2.allocationSize(value.value);
    }
  }
  ;
  return new FFIConverter();
})();
var EmbeddedMcpConfiguration = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeEmbeddedMcpConfiguration = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        command: FfiConverterString2.read(from),
        args: FfiConverterSequenceString2.read(from),
        environment: FfiConverterSequenceTypeEmbeddedEnvironmentVariable.read(from)
      };
    }
    write(value, into) {
      FfiConverterString2.write(value.command, into);
      FfiConverterSequenceString2.write(value.args, into);
      FfiConverterSequenceTypeEmbeddedEnvironmentVariable.write(value.environment, into);
    }
    allocationSize(value) {
      return FfiConverterString2.allocationSize(value.command) + FfiConverterSequenceString2.allocationSize(value.args) + FfiConverterSequenceTypeEmbeddedEnvironmentVariable.allocationSize(value.environment);
    }
  }
  ;
  return new FFIConverter();
})();
var EmbeddedDriverConnection = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeEmbeddedDriverConnection = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        socketPath: FfiConverterString2.read(from),
        pid: FfiConverterUInt32.read(from),
        generation: FfiConverterString2.read(from),
        driverVersion: FfiConverterString2.read(from),
        contractVersion: FfiConverterString2.read(from),
        mcpProtocolVersion: FfiConverterString2.read(from),
        mcp: FfiConverterTypeEmbeddedMcpConfiguration.read(from)
      };
    }
    write(value, into) {
      FfiConverterString2.write(value.socketPath, into);
      FfiConverterUInt32.write(value.pid, into);
      FfiConverterString2.write(value.generation, into);
      FfiConverterString2.write(value.driverVersion, into);
      FfiConverterString2.write(value.contractVersion, into);
      FfiConverterString2.write(value.mcpProtocolVersion, into);
      FfiConverterTypeEmbeddedMcpConfiguration.write(value.mcp, into);
    }
    allocationSize(value) {
      return FfiConverterString2.allocationSize(value.socketPath) + FfiConverterUInt32.allocationSize(value.pid) + FfiConverterString2.allocationSize(value.generation) + FfiConverterString2.allocationSize(value.driverVersion) + FfiConverterString2.allocationSize(value.contractVersion) + FfiConverterString2.allocationSize(value.mcpProtocolVersion) + FfiConverterTypeEmbeddedMcpConfiguration.allocationSize(value.mcp);
    }
  }
  ;
  return new FFIConverter();
})();
var EmbeddedDriverExit = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeEmbeddedDriverExit = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        generation: FfiConverterString2.read(from),
        code: FfiConverterOptionalInt322.read(from),
        success: FfiConverterBool.read(from)
      };
    }
    write(value, into) {
      FfiConverterString2.write(value.generation, into);
      FfiConverterOptionalInt322.write(value.code, into);
      FfiConverterBool.write(value.success, into);
    }
    allocationSize(value) {
      return FfiConverterString2.allocationSize(value.generation) + FfiConverterOptionalInt322.allocationSize(value.code) + FfiConverterBool.allocationSize(value.success);
    }
  }
  ;
  return new FFIConverter();
})();
var EmbeddedPermissionMode;
(function(EmbeddedPermissionMode2) {
  EmbeddedPermissionMode2[EmbeddedPermissionMode2["Standard"] = 0] = "Standard";
  EmbeddedPermissionMode2[EmbeddedPermissionMode2["Bounded"] = 1] = "Bounded";
  EmbeddedPermissionMode2[EmbeddedPermissionMode2["Unrestricted"] = 2] = "Unrestricted";
})(EmbeddedPermissionMode || (EmbeddedPermissionMode = {}));
var FfiConverterTypeEmbeddedPermissionMode = (() => {
  const ordinalConverter = FfiConverterInt32;
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      switch (ordinalConverter.read(from)) {
        case 1:
          return EmbeddedPermissionMode.Standard;
        case 2:
          return EmbeddedPermissionMode.Bounded;
        case 3:
          return EmbeddedPermissionMode.Unrestricted;
        default:
          throw new UniffiInternalError.UnexpectedEnumCase();
      }
    }
    write(value, into) {
      switch (value) {
        case EmbeddedPermissionMode.Standard:
          return ordinalConverter.write(1, into);
        case EmbeddedPermissionMode.Bounded:
          return ordinalConverter.write(2, into);
        case EmbeddedPermissionMode.Unrestricted:
          return ordinalConverter.write(3, into);
      }
    }
    allocationSize(value) {
      return ordinalConverter.allocationSize(0);
    }
  }
  return new FFIConverter();
})();
var EmbeddedDriverHostOptions = (() => {
  const defaults = () => ({
    capabilityManifestPath: void 0,
    approveCapabilityManifest: false,
    noOverlay: false
  });
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeEmbeddedDriverHostOptions = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        binaryPath: FfiConverterString2.read(from),
        hostBundleId: FfiConverterString2.read(from),
        socketPath: FfiConverterOptionalString2.read(from),
        startupTimeoutMs: FfiConverterOptionalUInt642.read(from),
        shutdownTimeoutMs: FfiConverterOptionalUInt642.read(from),
        permissionMode: FfiConverterOptionalTypeEmbeddedPermissionMode.read(from),
        capabilityManifestPath: FfiConverterOptionalString2.read(from),
        approveCapabilityManifest: FfiConverterBool.read(from),
        sessionPolicyPath: FfiConverterOptionalString2.read(from),
        approveSessionPolicy: FfiConverterBool.read(from),
        dangerouslyBypassApprovals: FfiConverterBool.read(from),
        environment: FfiConverterSequenceTypeEmbeddedEnvironmentVariable.read(from),
        inheritStderr: FfiConverterBool.read(from),
        noOverlay: FfiConverterBool.read(from)
      };
    }
    write(value, into) {
      FfiConverterString2.write(value.binaryPath, into);
      FfiConverterString2.write(value.hostBundleId, into);
      FfiConverterOptionalString2.write(value.socketPath, into);
      FfiConverterOptionalUInt642.write(value.startupTimeoutMs, into);
      FfiConverterOptionalUInt642.write(value.shutdownTimeoutMs, into);
      FfiConverterOptionalTypeEmbeddedPermissionMode.write(value.permissionMode, into);
      FfiConverterOptionalString2.write(value.capabilityManifestPath, into);
      FfiConverterBool.write(value.approveCapabilityManifest, into);
      FfiConverterOptionalString2.write(value.sessionPolicyPath, into);
      FfiConverterBool.write(value.approveSessionPolicy, into);
      FfiConverterBool.write(value.dangerouslyBypassApprovals, into);
      FfiConverterSequenceTypeEmbeddedEnvironmentVariable.write(value.environment, into);
      FfiConverterBool.write(value.inheritStderr, into);
      FfiConverterBool.write(value.noOverlay, into);
    }
    allocationSize(value) {
      return FfiConverterString2.allocationSize(value.binaryPath) + FfiConverterString2.allocationSize(value.hostBundleId) + FfiConverterOptionalString2.allocationSize(value.socketPath) + FfiConverterOptionalUInt642.allocationSize(value.startupTimeoutMs) + FfiConverterOptionalUInt642.allocationSize(value.shutdownTimeoutMs) + FfiConverterOptionalTypeEmbeddedPermissionMode.allocationSize(value.permissionMode) + FfiConverterOptionalString2.allocationSize(value.capabilityManifestPath) + FfiConverterBool.allocationSize(value.approveCapabilityManifest) + FfiConverterOptionalString2.allocationSize(value.sessionPolicyPath) + FfiConverterBool.allocationSize(value.approveSessionPolicy) + FfiConverterBool.allocationSize(value.dangerouslyBypassApprovals) + FfiConverterSequenceTypeEmbeddedEnvironmentVariable.allocationSize(value.environment) + FfiConverterBool.allocationSize(value.inheritStderr) + FfiConverterBool.allocationSize(value.noOverlay);
    }
  }
  ;
  return new FFIConverter();
})();
var ForeignDriverChannelIdentity = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeForeignDriverChannelIdentity = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        authenticatedPrincipal: FfiConverterString2.read(from),
        connectionGeneration: FfiConverterString2.read(from)
      };
    }
    write(value, into) {
      FfiConverterString2.write(value.authenticatedPrincipal, into);
      FfiConverterString2.write(value.connectionGeneration, into);
    }
    allocationSize(value) {
      return FfiConverterString2.allocationSize(value.authenticatedPrincipal) + FfiConverterString2.allocationSize(value.connectionGeneration);
    }
  }
  ;
  return new FFIConverter();
})();
var ForeignDriverChannelError_Tags;
(function(ForeignDriverChannelError_Tags2) {
  ForeignDriverChannelError_Tags2["Failed"] = "Failed";
})(ForeignDriverChannelError_Tags || (ForeignDriverChannelError_Tags = {}));
var ForeignDriverChannelError = (() => {
  class Failed_ extends UniffiError {
    /**
     * @private
     * This field is private and should not be used, use `tag` instead.
     */
    [uniffiTypeNameSymbol] = "ForeignDriverChannelError";
    tag = ForeignDriverChannelError_Tags.Failed;
    inner;
    constructor(inner) {
      super("ForeignDriverChannelError", "Failed");
      this.inner = Object.freeze(inner);
    }
    static new(inner) {
      return new Failed_(inner);
    }
    static instanceOf(obj) {
      return obj.tag === ForeignDriverChannelError_Tags.Failed;
    }
    static hasInner(obj) {
      return Failed_.instanceOf(obj);
    }
    static getInner(obj) {
      return obj.inner;
    }
  }
  function instanceOf(obj) {
    return obj[uniffiTypeNameSymbol] === "ForeignDriverChannelError";
  }
  return Object.freeze({
    instanceOf,
    Failed: Failed_
  });
})();
var FfiConverterTypeForeignDriverChannelError = (() => {
  const ordinalConverter = FfiConverterInt32;
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      switch (ordinalConverter.read(from)) {
        case 1:
          return new ForeignDriverChannelError.Failed({ reason: FfiConverterString2.read(from) });
        default:
          throw new UniffiInternalError.UnexpectedEnumCase();
      }
    }
    write(value, into) {
      switch (value.tag) {
        case ForeignDriverChannelError_Tags.Failed: {
          ordinalConverter.write(1, into);
          const inner = value.inner;
          FfiConverterString2.write(inner.reason, into);
          return;
        }
        default:
          throw new UniffiInternalError.UnexpectedEnumCase();
      }
    }
    allocationSize(value) {
      switch (value.tag) {
        case ForeignDriverChannelError_Tags.Failed: {
          const inner = value.inner;
          let size = ordinalConverter.allocationSize(1);
          size += FfiConverterString2.allocationSize(inner.reason);
          return size;
        }
        default:
          throw new UniffiInternalError.UnexpectedEnumCase();
      }
    }
  }
  return new FFIConverter();
})();
var ForeignDriverChannelCapabilities = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeForeignDriverChannelCapabilities = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        minimumEnvelopeVersion: FfiConverterUInt32.read(from),
        maximumEnvelopeVersion: FfiConverterUInt32.read(from),
        supportsCancellation: FfiConverterBool.read(from)
      };
    }
    write(value, into) {
      FfiConverterUInt32.write(value.minimumEnvelopeVersion, into);
      FfiConverterUInt32.write(value.maximumEnvelopeVersion, into);
      FfiConverterBool.write(value.supportsCancellation, into);
    }
    allocationSize(value) {
      return FfiConverterUInt32.allocationSize(value.minimumEnvelopeVersion) + FfiConverterUInt32.allocationSize(value.maximumEnvelopeVersion) + FfiConverterBool.allocationSize(value.supportsCancellation);
    }
  }
  ;
  return new FFIConverter();
})();
var ForeignDriverRequestEnvelope = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeForeignDriverRequestEnvelope = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        envelopeVersion: FfiConverterUInt32.read(from),
        requestId: FfiConverterString2.read(from),
        operation: FfiConverterString2.read(from),
        name: FfiConverterOptionalString2.read(from),
        argumentsJson: FfiConverterOptionalString2.read(from),
        deadlineUnixMs: FfiConverterUInt64.read(from)
      };
    }
    write(value, into) {
      FfiConverterUInt32.write(value.envelopeVersion, into);
      FfiConverterString2.write(value.requestId, into);
      FfiConverterString2.write(value.operation, into);
      FfiConverterOptionalString2.write(value.name, into);
      FfiConverterOptionalString2.write(value.argumentsJson, into);
      FfiConverterUInt64.write(value.deadlineUnixMs, into);
    }
    allocationSize(value) {
      return FfiConverterUInt32.allocationSize(value.envelopeVersion) + FfiConverterString2.allocationSize(value.requestId) + FfiConverterString2.allocationSize(value.operation) + FfiConverterOptionalString2.allocationSize(value.name) + FfiConverterOptionalString2.allocationSize(value.argumentsJson) + FfiConverterUInt64.allocationSize(value.deadlineUnixMs);
    }
  }
  ;
  return new FFIConverter();
})();
var ForeignDriverResponseEnvelope = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeForeignDriverResponseEnvelope = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        envelopeVersion: FfiConverterUInt32.read(from),
        requestId: FfiConverterString2.read(from),
        ok: FfiConverterBool.read(from),
        resultJson: FfiConverterOptionalString2.read(from),
        error: FfiConverterOptionalString2.read(from),
        errorCode: FfiConverterOptionalString2.read(from),
        completionKnown: FfiConverterBool.read(from)
      };
    }
    write(value, into) {
      FfiConverterUInt32.write(value.envelopeVersion, into);
      FfiConverterString2.write(value.requestId, into);
      FfiConverterBool.write(value.ok, into);
      FfiConverterOptionalString2.write(value.resultJson, into);
      FfiConverterOptionalString2.write(value.error, into);
      FfiConverterOptionalString2.write(value.errorCode, into);
      FfiConverterBool.write(value.completionKnown, into);
    }
    allocationSize(value) {
      return FfiConverterUInt32.allocationSize(value.envelopeVersion) + FfiConverterString2.allocationSize(value.requestId) + FfiConverterBool.allocationSize(value.ok) + FfiConverterOptionalString2.allocationSize(value.resultJson) + FfiConverterOptionalString2.allocationSize(value.error) + FfiConverterOptionalString2.allocationSize(value.errorCode) + FfiConverterBool.allocationSize(value.completionKnown);
    }
  }
  ;
  return new FFIConverter();
})();
var TrustedSessionOptions = (() => {
  const defaults = () => ({
    capabilityManifestPath: void 0
  });
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeTrustedSessionOptions = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        publicSession: FfiConverterString2.read(from),
        mode: FfiConverterTypeSessionPermissionMode.read(from),
        ttlSeconds: FfiConverterUInt64.read(from),
        idleTtlSeconds: FfiConverterUInt64.read(from),
        capabilityManifestPath: FfiConverterOptionalString2.read(from),
        boundedManifestPath: FfiConverterOptionalString2.read(from)
      };
    }
    write(value, into) {
      FfiConverterString2.write(value.publicSession, into);
      FfiConverterTypeSessionPermissionMode.write(value.mode, into);
      FfiConverterUInt64.write(value.ttlSeconds, into);
      FfiConverterUInt64.write(value.idleTtlSeconds, into);
      FfiConverterOptionalString2.write(value.capabilityManifestPath, into);
      FfiConverterOptionalString2.write(value.boundedManifestPath, into);
    }
    allocationSize(value) {
      return FfiConverterString2.allocationSize(value.publicSession) + FfiConverterTypeSessionPermissionMode.allocationSize(value.mode) + FfiConverterUInt64.allocationSize(value.ttlSeconds) + FfiConverterUInt64.allocationSize(value.idleTtlSeconds) + FfiConverterOptionalString2.allocationSize(value.capabilityManifestPath) + FfiConverterOptionalString2.allocationSize(value.boundedManifestPath);
    }
  }
  ;
  return new FFIConverter();
})();
var ForeignDriverEnvelopeChannelImpl = class extends UniffiAbstractObject {
  [uniffiTypeNameSymbol] = "ForeignDriverEnvelopeChannelImpl";
  [destructorGuardSymbol];
  [pointerLiteralSymbol];
  // No primary constructor declared for this class.
  constructor(pointer) {
    super();
    this[pointerLiteralSymbol] = pointer;
    this[destructorGuardSymbol] = uniffiTypeForeignDriverEnvelopeChannelImplObjectFactory.bless(pointer);
  }
  identity() {
    return ((__rb) => {
      try {
        return FfiConverterTypeForeignDriverChannelIdentity.lift(__rb);
      } finally {
        cua_driver_sdk_ffi_default().rustbuffer_free(__rb);
      }
    })(uniffiCaller2.rustCallWithError(
      /*liftError:*/
      FfiConverterTypeForeignDriverChannelError.lift.bind(FfiConverterTypeForeignDriverChannelError),
      /*caller:*/
      (callStatus) => {
        return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_foreigndriverenvelopechannel_identity(uniffiTypeForeignDriverEnvelopeChannelImplObjectFactory.clonePointer(this), callStatus);
      },
      /*liftString:*/
      FfiConverterString2.lift.bind(FfiConverterString2)
    ));
  }
  async negotiate(asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_foreigndriverenvelopechannel_negotiate(uniffiTypeForeignDriverEnvelopeChannelImplObjectFactory.clonePointer(this));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeForeignDriverChannelCapabilities.lift.bind(FfiConverterTypeForeignDriverChannelCapabilities),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeForeignDriverChannelError.lift.bind(FfiConverterTypeForeignDriverChannelError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  async exchange(request, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_foreigndriverenvelopechannel_exchange(uniffiTypeForeignDriverEnvelopeChannelImplObjectFactory.clonePointer(this), FfiConverterTypeForeignDriverRequestEnvelope.lower(request, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeForeignDriverResponseEnvelope.lift.bind(FfiConverterTypeForeignDriverResponseEnvelope),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeForeignDriverChannelError.lift.bind(FfiConverterTypeForeignDriverChannelError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  async bindSession(options, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_foreigndriverenvelopechannel_bind_session(uniffiTypeForeignDriverEnvelopeChannelImplObjectFactory.clonePointer(this), FfiConverterTypeTrustedSessionOptions.lower(options, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeForeignDriverBoundChannel.lift.bind(FfiConverterTypeForeignDriverBoundChannel),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeForeignDriverChannelError.lift.bind(FfiConverterTypeForeignDriverChannelError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  async cancel(requestId, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_foreigndriverenvelopechannel_cancel(uniffiTypeForeignDriverEnvelopeChannelImplObjectFactory.clonePointer(this), FfiConverterString2.lower(requestId, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_void,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_void,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_void,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_void,
        /*liftFunc:*/
        (_v) => {
        },
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeForeignDriverChannelError.lift.bind(FfiConverterTypeForeignDriverChannelError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  async close(asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_foreigndriverenvelopechannel_close(uniffiTypeForeignDriverEnvelopeChannelImplObjectFactory.clonePointer(this));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_void,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_void,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_void,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_void,
        /*liftFunc:*/
        (_v) => {
        },
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeForeignDriverChannelError.lift.bind(FfiConverterTypeForeignDriverChannelError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  uniffiDestroy() {
    const ptr = this[destructorGuardSymbol];
    if (ptr !== void 0) {
      const pointer = uniffiTypeForeignDriverEnvelopeChannelImplObjectFactory.pointer(this);
      uniffiTypeForeignDriverEnvelopeChannelImplObjectFactory.freePointer(pointer);
      uniffiTypeForeignDriverEnvelopeChannelImplObjectFactory.unbless(ptr);
      delete this[destructorGuardSymbol];
    }
  }
  static instanceOf(obj_) {
    return uniffiTypeForeignDriverEnvelopeChannelImplObjectFactory.isConcreteType(obj_);
  }
};
var uniffiTypeForeignDriverEnvelopeChannelImplObjectFactory = (() => {
  const registry = typeof FinalizationRegistry !== "undefined" ? new FinalizationRegistry((heldValue) => {
    uniffiTypeForeignDriverEnvelopeChannelImplObjectFactory.freePointer(heldValue);
  }) : null;
  return {
    create(pointer) {
      const instance = Object.create(ForeignDriverEnvelopeChannelImpl.prototype);
      instance[pointerLiteralSymbol] = pointer;
      instance[destructorGuardSymbol] = this.bless(pointer);
      instance[uniffiTypeNameSymbol] = "ForeignDriverEnvelopeChannelImpl";
      return instance;
    },
    bless(p) {
      const ptr = {
        p,
        // make sure this object doesn't get optimized away.
        markDestroyed: () => void 0
      };
      if (registry) {
        registry.register(ptr, p, ptr);
      }
      return ptr;
    },
    unbless(ptr_) {
      if (registry) {
        registry.unregister(ptr_);
      }
    },
    pointer(obj_) {
      if (obj_[destructorGuardSymbol] === void 0) {
        throw new UniffiInternalError.UnexpectedNullPointer();
      }
      return obj_[pointerLiteralSymbol];
    },
    clonePointer(obj_) {
      const pointer = this.pointer(obj_);
      return uniffiCaller2.rustCall(
        /*caller:*/
        (callStatus) => cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_clone_foreigndriverenvelopechannel(pointer, callStatus),
        /*liftString:*/
        FfiConverterString2.lift
      );
    },
    freePointer(pointer) {
      uniffiCaller2.rustCall(
        /*caller:*/
        (callStatus) => cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_free_foreigndriverenvelopechannel(pointer, callStatus),
        /*liftString:*/
        FfiConverterString2.lift
      );
    },
    isConcreteType(obj_) {
      return obj_[destructorGuardSymbol] && obj_[uniffiTypeNameSymbol] === "ForeignDriverEnvelopeChannelImpl";
    }
  };
})();
var FfiConverterTypeForeignDriverEnvelopeChannel = new FfiConverterObjectWithCallbacks(uniffiTypeForeignDriverEnvelopeChannelImplObjectFactory);
var uniffiCallbackInterfaceForeignDriverEnvelopeChannel = {
  // Create the VTable using a series of closures.
  // ts automatically converts these into C callback functions.
  vtable: {
    identity: (uniffiHandle) => {
      const uniffiMakeCall = () => {
        const jsCallback = FfiConverterTypeForeignDriverEnvelopeChannel.lift(uniffiHandle);
        return jsCallback.identity();
      };
      const uniffiResult = UniffiResult.ready();
      const uniffiHandleSuccess = (obj) => {
        UniffiResult.writeSuccess(uniffiResult, FfiConverterTypeForeignDriverChannelIdentity.lower(obj, cua_driver_sdk_ffi_default().rustbuffer_alloc));
      };
      const uniffiHandleError = (code, errBuf) => {
        UniffiResult.writeError(uniffiResult, code, errBuf);
      };
      uniffiTraitInterfaceCallWithError(
        /*makeCall:*/
        uniffiMakeCall,
        /*handleSuccess:*/
        uniffiHandleSuccess,
        /*handleError:*/
        uniffiHandleError,
        /*isErrorType:*/
        ForeignDriverChannelError.instanceOf,
        /*lowerError:*/
        FfiConverterTypeForeignDriverChannelError.lower.bind(FfiConverterTypeForeignDriverChannelError),
        /*lowerString:*/
        FfiConverterString2.lower.bind(FfiConverterString2),
        /*alloc:*/
        cua_driver_sdk_ffi_default().rustbuffer_alloc
      );
      return uniffiResult;
    },
    negotiate: (uniffiHandle, uniffiFutureCallback, uniffiCallbackData) => {
      const uniffiMakeCall = async (signal) => {
        const jsCallback = FfiConverterTypeForeignDriverEnvelopeChannel.lift(uniffiHandle);
        return await jsCallback.negotiate({ signal });
      };
      const uniffiHandleSuccess = (returnValue) => {
        uniffiFutureCallback.call(
          uniffiFutureCallback,
          uniffiCallbackData,
          /* UniffiForeignFutureResultRustBuffer */
          {
            return_value: FfiConverterTypeForeignDriverChannelCapabilities.lower(returnValue, cua_driver_sdk_ffi_default().rustbuffer_alloc),
            call_status: uniffiCaller2.createCallStatus()
          }
        );
      };
      const uniffiHandleError = (code, errorBuf) => {
        uniffiFutureCallback.call(
          uniffiFutureCallback,
          uniffiCallbackData,
          /* UniffiForeignFutureResultRustBuffer */
          {
            return_value: (
              /*empty*/
              new Uint8Array(0)
            ),
            // TODO create callstatus with error.
            call_status: uniffiCaller2.createErrorStatus(code, errorBuf)
          }
        );
      };
      const uniffiForeignFuture = uniffiTraitInterfaceCallAsyncWithError(
        /*makeCall:*/
        uniffiMakeCall,
        /*handleSuccess:*/
        uniffiHandleSuccess,
        /*handleError:*/
        uniffiHandleError,
        /*isErrorType:*/
        ForeignDriverChannelError.instanceOf,
        /*lowerError:*/
        FfiConverterTypeForeignDriverChannelError.lower.bind(FfiConverterTypeForeignDriverChannelError),
        /*lowerString:*/
        FfiConverterString2.lower.bind(FfiConverterString2),
        /*alloc:*/
        cua_driver_sdk_ffi_default().rustbuffer_alloc
      );
      return uniffiForeignFuture;
    },
    exchange: (uniffiHandle, request, uniffiFutureCallback, uniffiCallbackData) => {
      const uniffiMakeCall = async (signal) => {
        const jsCallback = FfiConverterTypeForeignDriverEnvelopeChannel.lift(uniffiHandle);
        return await jsCallback.exchange(FfiConverterTypeForeignDriverRequestEnvelope.lift(request), { signal });
      };
      const uniffiHandleSuccess = (returnValue) => {
        uniffiFutureCallback.call(
          uniffiFutureCallback,
          uniffiCallbackData,
          /* UniffiForeignFutureResultRustBuffer */
          {
            return_value: FfiConverterTypeForeignDriverResponseEnvelope.lower(returnValue, cua_driver_sdk_ffi_default().rustbuffer_alloc),
            call_status: uniffiCaller2.createCallStatus()
          }
        );
      };
      const uniffiHandleError = (code, errorBuf) => {
        uniffiFutureCallback.call(
          uniffiFutureCallback,
          uniffiCallbackData,
          /* UniffiForeignFutureResultRustBuffer */
          {
            return_value: (
              /*empty*/
              new Uint8Array(0)
            ),
            // TODO create callstatus with error.
            call_status: uniffiCaller2.createErrorStatus(code, errorBuf)
          }
        );
      };
      const uniffiForeignFuture = uniffiTraitInterfaceCallAsyncWithError(
        /*makeCall:*/
        uniffiMakeCall,
        /*handleSuccess:*/
        uniffiHandleSuccess,
        /*handleError:*/
        uniffiHandleError,
        /*isErrorType:*/
        ForeignDriverChannelError.instanceOf,
        /*lowerError:*/
        FfiConverterTypeForeignDriverChannelError.lower.bind(FfiConverterTypeForeignDriverChannelError),
        /*lowerString:*/
        FfiConverterString2.lower.bind(FfiConverterString2),
        /*alloc:*/
        cua_driver_sdk_ffi_default().rustbuffer_alloc
      );
      return uniffiForeignFuture;
    },
    bind_session: (uniffiHandle, options, uniffiFutureCallback, uniffiCallbackData) => {
      const uniffiMakeCall = async (signal) => {
        const jsCallback = FfiConverterTypeForeignDriverEnvelopeChannel.lift(uniffiHandle);
        return await jsCallback.bindSession(FfiConverterTypeTrustedSessionOptions.lift(options), { signal });
      };
      const uniffiHandleSuccess = (returnValue) => {
        uniffiFutureCallback.call(
          uniffiFutureCallback,
          uniffiCallbackData,
          /* UniffiForeignFutureResultRustBuffer */
          {
            return_value: FfiConverterTypeForeignDriverBoundChannel.lower(returnValue, cua_driver_sdk_ffi_default().rustbuffer_alloc),
            call_status: uniffiCaller2.createCallStatus()
          }
        );
      };
      const uniffiHandleError = (code, errorBuf) => {
        uniffiFutureCallback.call(
          uniffiFutureCallback,
          uniffiCallbackData,
          /* UniffiForeignFutureResultRustBuffer */
          {
            return_value: (
              /*empty*/
              new Uint8Array(0)
            ),
            // TODO create callstatus with error.
            call_status: uniffiCaller2.createErrorStatus(code, errorBuf)
          }
        );
      };
      const uniffiForeignFuture = uniffiTraitInterfaceCallAsyncWithError(
        /*makeCall:*/
        uniffiMakeCall,
        /*handleSuccess:*/
        uniffiHandleSuccess,
        /*handleError:*/
        uniffiHandleError,
        /*isErrorType:*/
        ForeignDriverChannelError.instanceOf,
        /*lowerError:*/
        FfiConverterTypeForeignDriverChannelError.lower.bind(FfiConverterTypeForeignDriverChannelError),
        /*lowerString:*/
        FfiConverterString2.lower.bind(FfiConverterString2),
        /*alloc:*/
        cua_driver_sdk_ffi_default().rustbuffer_alloc
      );
      return uniffiForeignFuture;
    },
    cancel: (uniffiHandle, requestId, uniffiFutureCallback, uniffiCallbackData) => {
      const uniffiMakeCall = async (signal) => {
        const jsCallback = FfiConverterTypeForeignDriverEnvelopeChannel.lift(uniffiHandle);
        return await jsCallback.cancel(FfiConverterString2.lift(requestId), { signal });
      };
      const uniffiHandleSuccess = (returnValue) => {
        uniffiFutureCallback.call(
          uniffiFutureCallback,
          uniffiCallbackData,
          /* UniffiForeignFutureResultVoid */
          {
            call_status: uniffiCaller2.createCallStatus()
          }
        );
      };
      const uniffiHandleError = (code, errorBuf) => {
        uniffiFutureCallback.call(
          uniffiFutureCallback,
          uniffiCallbackData,
          /* UniffiForeignFutureResultVoid */
          {
            // TODO create callstatus with error.
            call_status: uniffiCaller2.createErrorStatus(code, errorBuf)
          }
        );
      };
      const uniffiForeignFuture = uniffiTraitInterfaceCallAsyncWithError(
        /*makeCall:*/
        uniffiMakeCall,
        /*handleSuccess:*/
        uniffiHandleSuccess,
        /*handleError:*/
        uniffiHandleError,
        /*isErrorType:*/
        ForeignDriverChannelError.instanceOf,
        /*lowerError:*/
        FfiConverterTypeForeignDriverChannelError.lower.bind(FfiConverterTypeForeignDriverChannelError),
        /*lowerString:*/
        FfiConverterString2.lower.bind(FfiConverterString2),
        /*alloc:*/
        cua_driver_sdk_ffi_default().rustbuffer_alloc
      );
      return uniffiForeignFuture;
    },
    close: (uniffiHandle, uniffiFutureCallback, uniffiCallbackData) => {
      const uniffiMakeCall = async (signal) => {
        const jsCallback = FfiConverterTypeForeignDriverEnvelopeChannel.lift(uniffiHandle);
        return await jsCallback.close({ signal });
      };
      const uniffiHandleSuccess = (returnValue) => {
        uniffiFutureCallback.call(
          uniffiFutureCallback,
          uniffiCallbackData,
          /* UniffiForeignFutureResultVoid */
          {
            call_status: uniffiCaller2.createCallStatus()
          }
        );
      };
      const uniffiHandleError = (code, errorBuf) => {
        uniffiFutureCallback.call(
          uniffiFutureCallback,
          uniffiCallbackData,
          /* UniffiForeignFutureResultVoid */
          {
            // TODO create callstatus with error.
            call_status: uniffiCaller2.createErrorStatus(code, errorBuf)
          }
        );
      };
      const uniffiForeignFuture = uniffiTraitInterfaceCallAsyncWithError(
        /*makeCall:*/
        uniffiMakeCall,
        /*handleSuccess:*/
        uniffiHandleSuccess,
        /*handleError:*/
        uniffiHandleError,
        /*isErrorType:*/
        ForeignDriverChannelError.instanceOf,
        /*lowerError:*/
        FfiConverterTypeForeignDriverChannelError.lower.bind(FfiConverterTypeForeignDriverChannelError),
        /*lowerString:*/
        FfiConverterString2.lower.bind(FfiConverterString2),
        /*alloc:*/
        cua_driver_sdk_ffi_default().rustbuffer_alloc
      );
      return uniffiForeignFuture;
    },
    uniffi_free: (uniffiHandle) => {
      FfiConverterTypeForeignDriverEnvelopeChannel.drop(uniffiHandle);
    },
    uniffi_clone: (uniffiHandle) => {
      return FfiConverterTypeForeignDriverEnvelopeChannel.clone(uniffiHandle);
    }
  },
  register: () => {
    cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_init_callback_vtable_foreigndriverenvelopechannel(uniffiCallbackInterfaceForeignDriverEnvelopeChannel.vtable);
  }
};
var ForeignDriverBoundChannel = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeForeignDriverBoundChannel = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        channel: FfiConverterTypeForeignDriverEnvelopeChannel.read(from)
      };
    }
    write(value, into) {
      FfiConverterTypeForeignDriverEnvelopeChannel.write(value.channel, into);
    }
    allocationSize(value) {
      return FfiConverterTypeForeignDriverEnvelopeChannel.allocationSize(value.channel);
    }
  }
  ;
  return new FFIConverter();
})();
var ImageContent = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeImageContent = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        mimeType: FfiConverterString2.read(from),
        dataBase64: FfiConverterString2.read(from)
      };
    }
    write(value, into) {
      FfiConverterString2.write(value.mimeType, into);
      FfiConverterString2.write(value.dataBase64, into);
    }
    allocationSize(value) {
      return FfiConverterString2.allocationSize(value.mimeType) + FfiConverterString2.allocationSize(value.dataBase64);
    }
  }
  ;
  return new FFIConverter();
})();
var MacOsPermissionStatus = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeMacOsPermissionStatus = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        accessibility: FfiConverterBool.read(from),
        screenRecording: FfiConverterBool.read(from)
      };
    }
    write(value, into) {
      FfiConverterBool.write(value.accessibility, into);
      FfiConverterBool.write(value.screenRecording, into);
    }
    allocationSize(value) {
      return FfiConverterBool.allocationSize(value.accessibility) + FfiConverterBool.allocationSize(value.screenRecording);
    }
  }
  ;
  return new FFIConverter();
})();
var PrivateWorkerOptions = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypePrivateWorkerOptions = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        binaryPath: FfiConverterString2.read(from),
        hostBundleId: FfiConverterString2.read(from),
        startupTimeoutMs: FfiConverterOptionalUInt642.read(from),
        shutdownTimeoutMs: FfiConverterOptionalUInt642.read(from),
        configuredDriver: FfiConverterTypeConfiguredDriverOptions.read(from),
        environment: FfiConverterSequenceTypeEmbeddedEnvironmentVariable.read(from),
        inheritStderr: FfiConverterBool.read(from)
      };
    }
    write(value, into) {
      FfiConverterString2.write(value.binaryPath, into);
      FfiConverterString2.write(value.hostBundleId, into);
      FfiConverterOptionalUInt642.write(value.startupTimeoutMs, into);
      FfiConverterOptionalUInt642.write(value.shutdownTimeoutMs, into);
      FfiConverterTypeConfiguredDriverOptions.write(value.configuredDriver, into);
      FfiConverterSequenceTypeEmbeddedEnvironmentVariable.write(value.environment, into);
      FfiConverterBool.write(value.inheritStderr, into);
    }
    allocationSize(value) {
      return FfiConverterString2.allocationSize(value.binaryPath) + FfiConverterString2.allocationSize(value.hostBundleId) + FfiConverterOptionalUInt642.allocationSize(value.startupTimeoutMs) + FfiConverterOptionalUInt642.allocationSize(value.shutdownTimeoutMs) + FfiConverterTypeConfiguredDriverOptions.allocationSize(value.configuredDriver) + FfiConverterSequenceTypeEmbeddedEnvironmentVariable.allocationSize(value.environment) + FfiConverterBool.allocationSize(value.inheritStderr);
    }
  }
  ;
  return new FFIConverter();
})();
var ToolResult = (() => {
  const defaults = () => ({});
  const create = (() => {
    return uniffiCreateRecord(defaults);
  })();
  return Object.freeze({
    create,
    new: create,
    defaults: () => Object.freeze(defaults())
  });
})();
var FfiConverterTypeToolResult = (() => {
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      return {
        text: FfiConverterString2.read(from),
        images: FfiConverterSequenceTypeImageContent.read(from),
        structuredJson: FfiConverterOptionalString2.read(from),
        isError: FfiConverterBool.read(from),
        errorCode: FfiConverterOptionalString2.read(from),
        action: FfiConverterOptionalTypeActionResult.read(from),
        verification: FfiConverterOptionalTypeVerifyStateOutput.read(from),
        degraded: FfiConverterBool.read(from),
        rawJson: FfiConverterString2.read(from)
      };
    }
    write(value, into) {
      FfiConverterString2.write(value.text, into);
      FfiConverterSequenceTypeImageContent.write(value.images, into);
      FfiConverterOptionalString2.write(value.structuredJson, into);
      FfiConverterBool.write(value.isError, into);
      FfiConverterOptionalString2.write(value.errorCode, into);
      FfiConverterOptionalTypeActionResult.write(value.action, into);
      FfiConverterOptionalTypeVerifyStateOutput.write(value.verification, into);
      FfiConverterBool.write(value.degraded, into);
      FfiConverterString2.write(value.rawJson, into);
    }
    allocationSize(value) {
      return FfiConverterString2.allocationSize(value.text) + FfiConverterSequenceTypeImageContent.allocationSize(value.images) + FfiConverterOptionalString2.allocationSize(value.structuredJson) + FfiConverterBool.allocationSize(value.isError) + FfiConverterOptionalString2.allocationSize(value.errorCode) + FfiConverterOptionalTypeActionResult.allocationSize(value.action) + FfiConverterOptionalTypeVerifyStateOutput.allocationSize(value.verification) + FfiConverterBool.allocationSize(value.degraded) + FfiConverterString2.allocationSize(value.rawJson);
    }
  }
  ;
  return new FFIConverter();
})();
var ActionCompletion;
(function(ActionCompletion2) {
  ActionCompletion2[ActionCompletion2["NotStarted"] = 0] = "NotStarted";
  ActionCompletion2[ActionCompletion2["Completed"] = 1] = "Completed";
  ActionCompletion2[ActionCompletion2["Unknown"] = 2] = "Unknown";
})(ActionCompletion || (ActionCompletion = {}));
var FfiConverterTypeActionCompletion = (() => {
  const ordinalConverter = FfiConverterInt32;
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      switch (ordinalConverter.read(from)) {
        case 1:
          return ActionCompletion.NotStarted;
        case 2:
          return ActionCompletion.Completed;
        case 3:
          return ActionCompletion.Unknown;
        default:
          throw new UniffiInternalError.UnexpectedEnumCase();
      }
    }
    write(value, into) {
      switch (value) {
        case ActionCompletion.NotStarted:
          return ordinalConverter.write(1, into);
        case ActionCompletion.Completed:
          return ordinalConverter.write(2, into);
        case ActionCompletion.Unknown:
          return ordinalConverter.write(3, into);
      }
    }
    allocationSize(value) {
      return ordinalConverter.allocationSize(0);
    }
  }
  return new FFIConverter();
})();
var DriverAuthorizationHostError_Tags;
(function(DriverAuthorizationHostError_Tags2) {
  DriverAuthorizationHostError_Tags2["Failed"] = "Failed";
})(DriverAuthorizationHostError_Tags || (DriverAuthorizationHostError_Tags = {}));
var DriverAuthorizationHostError = (() => {
  class Failed_ extends UniffiError {
    /**
     * @private
     * This field is private and should not be used, use `tag` instead.
     */
    [uniffiTypeNameSymbol] = "DriverAuthorizationHostError";
    tag = DriverAuthorizationHostError_Tags.Failed;
    inner;
    constructor(inner) {
      super("DriverAuthorizationHostError", "Failed");
      this.inner = Object.freeze(inner);
    }
    static new(inner) {
      return new Failed_(inner);
    }
    static instanceOf(obj) {
      return obj.tag === DriverAuthorizationHostError_Tags.Failed;
    }
    static hasInner(obj) {
      return Failed_.instanceOf(obj);
    }
    static getInner(obj) {
      return obj.inner;
    }
  }
  function instanceOf(obj) {
    return obj[uniffiTypeNameSymbol] === "DriverAuthorizationHostError";
  }
  return Object.freeze({
    instanceOf,
    Failed: Failed_
  });
})();
var FfiConverterTypeDriverAuthorizationHostError = (() => {
  const ordinalConverter = FfiConverterInt32;
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      switch (ordinalConverter.read(from)) {
        case 1:
          return new DriverAuthorizationHostError.Failed({ reason: FfiConverterString2.read(from) });
        default:
          throw new UniffiInternalError.UnexpectedEnumCase();
      }
    }
    write(value, into) {
      switch (value.tag) {
        case DriverAuthorizationHostError_Tags.Failed: {
          ordinalConverter.write(1, into);
          const inner = value.inner;
          FfiConverterString2.write(inner.reason, into);
          return;
        }
        default:
          throw new UniffiInternalError.UnexpectedEnumCase();
      }
    }
    allocationSize(value) {
      switch (value.tag) {
        case DriverAuthorizationHostError_Tags.Failed: {
          const inner = value.inner;
          let size = ordinalConverter.allocationSize(1);
          size += FfiConverterString2.allocationSize(inner.reason);
          return size;
        }
        default:
          throw new UniffiInternalError.UnexpectedEnumCase();
      }
    }
  }
  return new FFIConverter();
})();
var DriverError_Tags;
(function(DriverError_Tags2) {
  DriverError_Tags2["Configuration"] = "Configuration";
  DriverError_Tags2["InvalidArguments"] = "InvalidArguments";
  DriverError_Tags2["Transport"] = "Transport";
  DriverError_Tags2["Protocol"] = "Protocol";
  DriverError_Tags2["Tool"] = "Tool";
  DriverError_Tags2["Shutdown"] = "Shutdown";
  DriverError_Tags2["RuntimeAlreadyExists"] = "RuntimeAlreadyExists";
  DriverError_Tags2["Worker"] = "Worker";
  DriverError_Tags2["Remote"] = "Remote";
  DriverError_Tags2["ActionInterrupted"] = "ActionInterrupted";
})(DriverError_Tags || (DriverError_Tags = {}));
var DriverError = (() => {
  class Configuration_ extends UniffiError {
    /**
     * @private
     * This field is private and should not be used, use `tag` instead.
     */
    [uniffiTypeNameSymbol] = "DriverError";
    tag = DriverError_Tags.Configuration;
    inner;
    constructor(inner) {
      super("DriverError", "Configuration");
      this.inner = Object.freeze(inner);
    }
    static new(inner) {
      return new Configuration_(inner);
    }
    static instanceOf(obj) {
      return obj.tag === DriverError_Tags.Configuration;
    }
    static hasInner(obj) {
      return Configuration_.instanceOf(obj);
    }
    static getInner(obj) {
      return obj.inner;
    }
  }
  class InvalidArguments_ extends UniffiError {
    /**
     * @private
     * This field is private and should not be used, use `tag` instead.
     */
    [uniffiTypeNameSymbol] = "DriverError";
    tag = DriverError_Tags.InvalidArguments;
    inner;
    constructor(inner) {
      super("DriverError", "InvalidArguments");
      this.inner = Object.freeze(inner);
    }
    static new(inner) {
      return new InvalidArguments_(inner);
    }
    static instanceOf(obj) {
      return obj.tag === DriverError_Tags.InvalidArguments;
    }
    static hasInner(obj) {
      return InvalidArguments_.instanceOf(obj);
    }
    static getInner(obj) {
      return obj.inner;
    }
  }
  class Transport_ extends UniffiError {
    /**
     * @private
     * This field is private and should not be used, use `tag` instead.
     */
    [uniffiTypeNameSymbol] = "DriverError";
    tag = DriverError_Tags.Transport;
    inner;
    constructor(inner) {
      super("DriverError", "Transport");
      this.inner = Object.freeze(inner);
    }
    static new(inner) {
      return new Transport_(inner);
    }
    static instanceOf(obj) {
      return obj.tag === DriverError_Tags.Transport;
    }
    static hasInner(obj) {
      return Transport_.instanceOf(obj);
    }
    static getInner(obj) {
      return obj.inner;
    }
  }
  class Protocol_ extends UniffiError {
    /**
     * @private
     * This field is private and should not be used, use `tag` instead.
     */
    [uniffiTypeNameSymbol] = "DriverError";
    tag = DriverError_Tags.Protocol;
    inner;
    constructor(inner) {
      super("DriverError", "Protocol");
      this.inner = Object.freeze(inner);
    }
    static new(inner) {
      return new Protocol_(inner);
    }
    static instanceOf(obj) {
      return obj.tag === DriverError_Tags.Protocol;
    }
    static hasInner(obj) {
      return Protocol_.instanceOf(obj);
    }
    static getInner(obj) {
      return obj.inner;
    }
  }
  class Tool_ extends UniffiError {
    /**
     * @private
     * This field is private and should not be used, use `tag` instead.
     */
    [uniffiTypeNameSymbol] = "DriverError";
    tag = DriverError_Tags.Tool;
    inner;
    constructor(inner) {
      super("DriverError", "Tool");
      this.inner = Object.freeze(inner);
    }
    static new(inner) {
      return new Tool_(inner);
    }
    static instanceOf(obj) {
      return obj.tag === DriverError_Tags.Tool;
    }
    static hasInner(obj) {
      return Tool_.instanceOf(obj);
    }
    static getInner(obj) {
      return obj.inner;
    }
  }
  class Shutdown_ extends UniffiError {
    /**
     * @private
     * This field is private and should not be used, use `tag` instead.
     */
    [uniffiTypeNameSymbol] = "DriverError";
    tag = DriverError_Tags.Shutdown;
    constructor() {
      super("DriverError", "Shutdown");
    }
    static new() {
      return new Shutdown_();
    }
    static instanceOf(obj) {
      return obj.tag === DriverError_Tags.Shutdown;
    }
    static hasInner(obj) {
      return false;
    }
  }
  class RuntimeAlreadyExists_ extends UniffiError {
    /**
     * @private
     * This field is private and should not be used, use `tag` instead.
     */
    [uniffiTypeNameSymbol] = "DriverError";
    tag = DriverError_Tags.RuntimeAlreadyExists;
    constructor() {
      super("DriverError", "RuntimeAlreadyExists");
    }
    static new() {
      return new RuntimeAlreadyExists_();
    }
    static instanceOf(obj) {
      return obj.tag === DriverError_Tags.RuntimeAlreadyExists;
    }
    static hasInner(obj) {
      return false;
    }
  }
  class Worker_ extends UniffiError {
    /**
     * @private
     * This field is private and should not be used, use `tag` instead.
     */
    [uniffiTypeNameSymbol] = "DriverError";
    tag = DriverError_Tags.Worker;
    inner;
    constructor(inner) {
      super("DriverError", "Worker");
      this.inner = Object.freeze(inner);
    }
    static new(inner) {
      return new Worker_(inner);
    }
    static instanceOf(obj) {
      return obj.tag === DriverError_Tags.Worker;
    }
    static hasInner(obj) {
      return Worker_.instanceOf(obj);
    }
    static getInner(obj) {
      return obj.inner;
    }
  }
  class Remote_ extends UniffiError {
    /**
     * @private
     * This field is private and should not be used, use `tag` instead.
     */
    [uniffiTypeNameSymbol] = "DriverError";
    tag = DriverError_Tags.Remote;
    inner;
    constructor(inner) {
      super("DriverError", "Remote");
      this.inner = Object.freeze(inner);
    }
    static new(inner) {
      return new Remote_(inner);
    }
    static instanceOf(obj) {
      return obj.tag === DriverError_Tags.Remote;
    }
    static hasInner(obj) {
      return Remote_.instanceOf(obj);
    }
    static getInner(obj) {
      return obj.inner;
    }
  }
  class ActionInterrupted_ extends UniffiError {
    /**
     * @private
     * This field is private and should not be used, use `tag` instead.
     */
    [uniffiTypeNameSymbol] = "DriverError";
    tag = DriverError_Tags.ActionInterrupted;
    inner;
    constructor(inner) {
      super("DriverError", "ActionInterrupted");
      this.inner = Object.freeze(inner);
    }
    static new(inner) {
      return new ActionInterrupted_(inner);
    }
    static instanceOf(obj) {
      return obj.tag === DriverError_Tags.ActionInterrupted;
    }
    static hasInner(obj) {
      return ActionInterrupted_.instanceOf(obj);
    }
    static getInner(obj) {
      return obj.inner;
    }
  }
  function instanceOf(obj) {
    return obj[uniffiTypeNameSymbol] === "DriverError";
  }
  return Object.freeze({
    instanceOf,
    Configuration: Configuration_,
    InvalidArguments: InvalidArguments_,
    Transport: Transport_,
    Protocol: Protocol_,
    Tool: Tool_,
    Shutdown: Shutdown_,
    RuntimeAlreadyExists: RuntimeAlreadyExists_,
    Worker: Worker_,
    Remote: Remote_,
    ActionInterrupted: ActionInterrupted_
  });
})();
var FfiConverterTypeDriverError = (() => {
  const ordinalConverter = FfiConverterInt32;
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      switch (ordinalConverter.read(from)) {
        case 1:
          return new DriverError.Configuration({ reason: FfiConverterString2.read(from) });
        case 2:
          return new DriverError.InvalidArguments({ tool: FfiConverterString2.read(from), reason: FfiConverterString2.read(from) });
        case 3:
          return new DriverError.Transport({ socketPath: FfiConverterString2.read(from), reason: FfiConverterString2.read(from) });
        case 4:
          return new DriverError.Protocol({ reason: FfiConverterString2.read(from) });
        case 5:
          return new DriverError.Tool({ tool: FfiConverterString2.read(from), message: FfiConverterString2.read(from), errorCode: FfiConverterString2.read(from) });
        case 6:
          return new DriverError.Shutdown();
        case 7:
          return new DriverError.RuntimeAlreadyExists();
        case 8:
          return new DriverError.Worker({ reason: FfiConverterString2.read(from) });
        case 9:
          return new DriverError.Remote({ reason: FfiConverterString2.read(from) });
        case 10:
          return new DriverError.ActionInterrupted({ completion: FfiConverterTypeActionCompletion.read(from), reason: FfiConverterString2.read(from) });
        default:
          throw new UniffiInternalError.UnexpectedEnumCase();
      }
    }
    write(value, into) {
      switch (value.tag) {
        case DriverError_Tags.Configuration: {
          ordinalConverter.write(1, into);
          const inner = value.inner;
          FfiConverterString2.write(inner.reason, into);
          return;
        }
        case DriverError_Tags.InvalidArguments: {
          ordinalConverter.write(2, into);
          const inner = value.inner;
          FfiConverterString2.write(inner.tool, into);
          FfiConverterString2.write(inner.reason, into);
          return;
        }
        case DriverError_Tags.Transport: {
          ordinalConverter.write(3, into);
          const inner = value.inner;
          FfiConverterString2.write(inner.socketPath, into);
          FfiConverterString2.write(inner.reason, into);
          return;
        }
        case DriverError_Tags.Protocol: {
          ordinalConverter.write(4, into);
          const inner = value.inner;
          FfiConverterString2.write(inner.reason, into);
          return;
        }
        case DriverError_Tags.Tool: {
          ordinalConverter.write(5, into);
          const inner = value.inner;
          FfiConverterString2.write(inner.tool, into);
          FfiConverterString2.write(inner.message, into);
          FfiConverterString2.write(inner.errorCode, into);
          return;
        }
        case DriverError_Tags.Shutdown: {
          ordinalConverter.write(6, into);
          return;
        }
        case DriverError_Tags.RuntimeAlreadyExists: {
          ordinalConverter.write(7, into);
          return;
        }
        case DriverError_Tags.Worker: {
          ordinalConverter.write(8, into);
          const inner = value.inner;
          FfiConverterString2.write(inner.reason, into);
          return;
        }
        case DriverError_Tags.Remote: {
          ordinalConverter.write(9, into);
          const inner = value.inner;
          FfiConverterString2.write(inner.reason, into);
          return;
        }
        case DriverError_Tags.ActionInterrupted: {
          ordinalConverter.write(10, into);
          const inner = value.inner;
          FfiConverterTypeActionCompletion.write(inner.completion, into);
          FfiConverterString2.write(inner.reason, into);
          return;
        }
        default:
          throw new UniffiInternalError.UnexpectedEnumCase();
      }
    }
    allocationSize(value) {
      switch (value.tag) {
        case DriverError_Tags.Configuration: {
          const inner = value.inner;
          let size = ordinalConverter.allocationSize(1);
          size += FfiConverterString2.allocationSize(inner.reason);
          return size;
        }
        case DriverError_Tags.InvalidArguments: {
          const inner = value.inner;
          let size = ordinalConverter.allocationSize(2);
          size += FfiConverterString2.allocationSize(inner.tool);
          size += FfiConverterString2.allocationSize(inner.reason);
          return size;
        }
        case DriverError_Tags.Transport: {
          const inner = value.inner;
          let size = ordinalConverter.allocationSize(3);
          size += FfiConverterString2.allocationSize(inner.socketPath);
          size += FfiConverterString2.allocationSize(inner.reason);
          return size;
        }
        case DriverError_Tags.Protocol: {
          const inner = value.inner;
          let size = ordinalConverter.allocationSize(4);
          size += FfiConverterString2.allocationSize(inner.reason);
          return size;
        }
        case DriverError_Tags.Tool: {
          const inner = value.inner;
          let size = ordinalConverter.allocationSize(5);
          size += FfiConverterString2.allocationSize(inner.tool);
          size += FfiConverterString2.allocationSize(inner.message);
          size += FfiConverterString2.allocationSize(inner.errorCode);
          return size;
        }
        case DriverError_Tags.Shutdown: {
          return ordinalConverter.allocationSize(6);
        }
        case DriverError_Tags.RuntimeAlreadyExists: {
          return ordinalConverter.allocationSize(7);
        }
        case DriverError_Tags.Worker: {
          const inner = value.inner;
          let size = ordinalConverter.allocationSize(8);
          size += FfiConverterString2.allocationSize(inner.reason);
          return size;
        }
        case DriverError_Tags.Remote: {
          const inner = value.inner;
          let size = ordinalConverter.allocationSize(9);
          size += FfiConverterString2.allocationSize(inner.reason);
          return size;
        }
        case DriverError_Tags.ActionInterrupted: {
          const inner = value.inner;
          let size = ordinalConverter.allocationSize(10);
          size += FfiConverterTypeActionCompletion.allocationSize(inner.completion);
          size += FfiConverterString2.allocationSize(inner.reason);
          return size;
        }
        default:
          throw new UniffiInternalError.UnexpectedEnumCase();
      }
    }
  }
  return new FFIConverter();
})();
var DriverExecutionMode;
(function(DriverExecutionMode2) {
  DriverExecutionMode2[DriverExecutionMode2["Embedded"] = 0] = "Embedded";
  DriverExecutionMode2[DriverExecutionMode2["Daemon"] = 1] = "Daemon";
  DriverExecutionMode2[DriverExecutionMode2["PrivateWorker"] = 2] = "PrivateWorker";
  DriverExecutionMode2[DriverExecutionMode2["Remote"] = 3] = "Remote";
})(DriverExecutionMode || (DriverExecutionMode = {}));
var FfiConverterTypeDriverExecutionMode = (() => {
  const ordinalConverter = FfiConverterInt32;
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      switch (ordinalConverter.read(from)) {
        case 1:
          return DriverExecutionMode.Embedded;
        case 2:
          return DriverExecutionMode.Daemon;
        case 3:
          return DriverExecutionMode.PrivateWorker;
        case 4:
          return DriverExecutionMode.Remote;
        default:
          throw new UniffiInternalError.UnexpectedEnumCase();
      }
    }
    write(value, into) {
      switch (value) {
        case DriverExecutionMode.Embedded:
          return ordinalConverter.write(1, into);
        case DriverExecutionMode.Daemon:
          return ordinalConverter.write(2, into);
        case DriverExecutionMode.PrivateWorker:
          return ordinalConverter.write(3, into);
        case DriverExecutionMode.Remote:
          return ordinalConverter.write(4, into);
      }
    }
    allocationSize(value) {
      return ordinalConverter.allocationSize(0);
    }
  }
  return new FFIConverter();
})();
var DriverServiceTransportError_Tags;
(function(DriverServiceTransportError_Tags2) {
  DriverServiceTransportError_Tags2["Failed"] = "Failed";
})(DriverServiceTransportError_Tags || (DriverServiceTransportError_Tags = {}));
var DriverServiceTransportError = (() => {
  class Failed_ extends UniffiError {
    /**
     * @private
     * This field is private and should not be used, use `tag` instead.
     */
    [uniffiTypeNameSymbol] = "DriverServiceTransportError";
    tag = DriverServiceTransportError_Tags.Failed;
    inner;
    constructor(inner) {
      super("DriverServiceTransportError", "Failed");
      this.inner = Object.freeze(inner);
    }
    static new(inner) {
      return new Failed_(inner);
    }
    static instanceOf(obj) {
      return obj.tag === DriverServiceTransportError_Tags.Failed;
    }
    static hasInner(obj) {
      return Failed_.instanceOf(obj);
    }
    static getInner(obj) {
      return obj.inner;
    }
  }
  function instanceOf(obj) {
    return obj[uniffiTypeNameSymbol] === "DriverServiceTransportError";
  }
  return Object.freeze({
    instanceOf,
    Failed: Failed_
  });
})();
var FfiConverterTypeDriverServiceTransportError = (() => {
  const ordinalConverter = FfiConverterInt32;
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      switch (ordinalConverter.read(from)) {
        case 1:
          return new DriverServiceTransportError.Failed({ reason: FfiConverterString2.read(from) });
        default:
          throw new UniffiInternalError.UnexpectedEnumCase();
      }
    }
    write(value, into) {
      switch (value.tag) {
        case DriverServiceTransportError_Tags.Failed: {
          ordinalConverter.write(1, into);
          const inner = value.inner;
          FfiConverterString2.write(inner.reason, into);
          return;
        }
        default:
          throw new UniffiInternalError.UnexpectedEnumCase();
      }
    }
    allocationSize(value) {
      switch (value.tag) {
        case DriverServiceTransportError_Tags.Failed: {
          const inner = value.inner;
          let size = ordinalConverter.allocationSize(1);
          size += FfiConverterString2.allocationSize(inner.reason);
          return size;
        }
        default:
          throw new UniffiInternalError.UnexpectedEnumCase();
      }
    }
  }
  return new FFIConverter();
})();
var EmbeddedDriverError_Tags;
(function(EmbeddedDriverError_Tags2) {
  EmbeddedDriverError_Tags2["Configuration"] = "Configuration";
  EmbeddedDriverError_Tags2["EndpointConflict"] = "EndpointConflict";
  EmbeddedDriverError_Tags2["Spawn"] = "Spawn";
  EmbeddedDriverError_Tags2["StartupCancelled"] = "StartupCancelled";
  EmbeddedDriverError_Tags2["StartupTimeout"] = "StartupTimeout";
  EmbeddedDriverError_Tags2["ExitedBeforeReady"] = "ExitedBeforeReady";
  EmbeddedDriverError_Tags2["IncompatibleDaemon"] = "IncompatibleDaemon";
  EmbeddedDriverError_Tags2["Lifecycle"] = "Lifecycle";
})(EmbeddedDriverError_Tags || (EmbeddedDriverError_Tags = {}));
var EmbeddedDriverError = (() => {
  class Configuration_ extends UniffiError {
    /**
     * @private
     * This field is private and should not be used, use `tag` instead.
     */
    [uniffiTypeNameSymbol] = "EmbeddedDriverError";
    tag = EmbeddedDriverError_Tags.Configuration;
    inner;
    constructor(inner) {
      super("EmbeddedDriverError", "Configuration");
      this.inner = Object.freeze(inner);
    }
    static new(inner) {
      return new Configuration_(inner);
    }
    static instanceOf(obj) {
      return obj.tag === EmbeddedDriverError_Tags.Configuration;
    }
    static hasInner(obj) {
      return Configuration_.instanceOf(obj);
    }
    static getInner(obj) {
      return obj.inner;
    }
  }
  class EndpointConflict_ extends UniffiError {
    /**
     * @private
     * This field is private and should not be used, use `tag` instead.
     */
    [uniffiTypeNameSymbol] = "EmbeddedDriverError";
    tag = EmbeddedDriverError_Tags.EndpointConflict;
    inner;
    constructor(inner) {
      super("EmbeddedDriverError", "EndpointConflict");
      this.inner = Object.freeze(inner);
    }
    static new(inner) {
      return new EndpointConflict_(inner);
    }
    static instanceOf(obj) {
      return obj.tag === EmbeddedDriverError_Tags.EndpointConflict;
    }
    static hasInner(obj) {
      return EndpointConflict_.instanceOf(obj);
    }
    static getInner(obj) {
      return obj.inner;
    }
  }
  class Spawn_ extends UniffiError {
    /**
     * @private
     * This field is private and should not be used, use `tag` instead.
     */
    [uniffiTypeNameSymbol] = "EmbeddedDriverError";
    tag = EmbeddedDriverError_Tags.Spawn;
    inner;
    constructor(inner) {
      super("EmbeddedDriverError", "Spawn");
      this.inner = Object.freeze(inner);
    }
    static new(inner) {
      return new Spawn_(inner);
    }
    static instanceOf(obj) {
      return obj.tag === EmbeddedDriverError_Tags.Spawn;
    }
    static hasInner(obj) {
      return Spawn_.instanceOf(obj);
    }
    static getInner(obj) {
      return obj.inner;
    }
  }
  class StartupCancelled_ extends UniffiError {
    /**
     * @private
     * This field is private and should not be used, use `tag` instead.
     */
    [uniffiTypeNameSymbol] = "EmbeddedDriverError";
    tag = EmbeddedDriverError_Tags.StartupCancelled;
    constructor() {
      super("EmbeddedDriverError", "StartupCancelled");
    }
    static new() {
      return new StartupCancelled_();
    }
    static instanceOf(obj) {
      return obj.tag === EmbeddedDriverError_Tags.StartupCancelled;
    }
    static hasInner(obj) {
      return false;
    }
  }
  class StartupTimeout_ extends UniffiError {
    /**
     * @private
     * This field is private and should not be used, use `tag` instead.
     */
    [uniffiTypeNameSymbol] = "EmbeddedDriverError";
    tag = EmbeddedDriverError_Tags.StartupTimeout;
    inner;
    constructor(inner) {
      super("EmbeddedDriverError", "StartupTimeout");
      this.inner = Object.freeze(inner);
    }
    static new(inner) {
      return new StartupTimeout_(inner);
    }
    static instanceOf(obj) {
      return obj.tag === EmbeddedDriverError_Tags.StartupTimeout;
    }
    static hasInner(obj) {
      return StartupTimeout_.instanceOf(obj);
    }
    static getInner(obj) {
      return obj.inner;
    }
  }
  class ExitedBeforeReady_ extends UniffiError {
    /**
     * @private
     * This field is private and should not be used, use `tag` instead.
     */
    [uniffiTypeNameSymbol] = "EmbeddedDriverError";
    tag = EmbeddedDriverError_Tags.ExitedBeforeReady;
    inner;
    constructor(inner) {
      super("EmbeddedDriverError", "ExitedBeforeReady");
      this.inner = Object.freeze(inner);
    }
    static new(inner) {
      return new ExitedBeforeReady_(inner);
    }
    static instanceOf(obj) {
      return obj.tag === EmbeddedDriverError_Tags.ExitedBeforeReady;
    }
    static hasInner(obj) {
      return ExitedBeforeReady_.instanceOf(obj);
    }
    static getInner(obj) {
      return obj.inner;
    }
  }
  class IncompatibleDaemon_ extends UniffiError {
    /**
     * @private
     * This field is private and should not be used, use `tag` instead.
     */
    [uniffiTypeNameSymbol] = "EmbeddedDriverError";
    tag = EmbeddedDriverError_Tags.IncompatibleDaemon;
    inner;
    constructor(inner) {
      super("EmbeddedDriverError", "IncompatibleDaemon");
      this.inner = Object.freeze(inner);
    }
    static new(inner) {
      return new IncompatibleDaemon_(inner);
    }
    static instanceOf(obj) {
      return obj.tag === EmbeddedDriverError_Tags.IncompatibleDaemon;
    }
    static hasInner(obj) {
      return IncompatibleDaemon_.instanceOf(obj);
    }
    static getInner(obj) {
      return obj.inner;
    }
  }
  class Lifecycle_ extends UniffiError {
    /**
     * @private
     * This field is private and should not be used, use `tag` instead.
     */
    [uniffiTypeNameSymbol] = "EmbeddedDriverError";
    tag = EmbeddedDriverError_Tags.Lifecycle;
    inner;
    constructor(inner) {
      super("EmbeddedDriverError", "Lifecycle");
      this.inner = Object.freeze(inner);
    }
    static new(inner) {
      return new Lifecycle_(inner);
    }
    static instanceOf(obj) {
      return obj.tag === EmbeddedDriverError_Tags.Lifecycle;
    }
    static hasInner(obj) {
      return Lifecycle_.instanceOf(obj);
    }
    static getInner(obj) {
      return obj.inner;
    }
  }
  function instanceOf(obj) {
    return obj[uniffiTypeNameSymbol] === "EmbeddedDriverError";
  }
  return Object.freeze({
    instanceOf,
    Configuration: Configuration_,
    EndpointConflict: EndpointConflict_,
    Spawn: Spawn_,
    StartupCancelled: StartupCancelled_,
    StartupTimeout: StartupTimeout_,
    ExitedBeforeReady: ExitedBeforeReady_,
    IncompatibleDaemon: IncompatibleDaemon_,
    Lifecycle: Lifecycle_
  });
})();
var FfiConverterTypeEmbeddedDriverError = (() => {
  const ordinalConverter = FfiConverterInt32;
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      switch (ordinalConverter.read(from)) {
        case 1:
          return new EmbeddedDriverError.Configuration({ reason: FfiConverterString2.read(from) });
        case 2:
          return new EmbeddedDriverError.EndpointConflict({ path: FfiConverterString2.read(from), reason: FfiConverterString2.read(from) });
        case 3:
          return new EmbeddedDriverError.Spawn({ binaryPath: FfiConverterString2.read(from), reason: FfiConverterString2.read(from) });
        case 4:
          return new EmbeddedDriverError.StartupCancelled();
        case 5:
          return new EmbeddedDriverError.StartupTimeout({ timeoutMs: FfiConverterUInt64.read(from) });
        case 6:
          return new EmbeddedDriverError.ExitedBeforeReady({ code: FfiConverterOptionalInt322.read(from) });
        case 7:
          return new EmbeddedDriverError.IncompatibleDaemon({ reason: FfiConverterString2.read(from) });
        case 8:
          return new EmbeddedDriverError.Lifecycle({ reason: FfiConverterString2.read(from) });
        default:
          throw new UniffiInternalError.UnexpectedEnumCase();
      }
    }
    write(value, into) {
      switch (value.tag) {
        case EmbeddedDriverError_Tags.Configuration: {
          ordinalConverter.write(1, into);
          const inner = value.inner;
          FfiConverterString2.write(inner.reason, into);
          return;
        }
        case EmbeddedDriverError_Tags.EndpointConflict: {
          ordinalConverter.write(2, into);
          const inner = value.inner;
          FfiConverterString2.write(inner.path, into);
          FfiConverterString2.write(inner.reason, into);
          return;
        }
        case EmbeddedDriverError_Tags.Spawn: {
          ordinalConverter.write(3, into);
          const inner = value.inner;
          FfiConverterString2.write(inner.binaryPath, into);
          FfiConverterString2.write(inner.reason, into);
          return;
        }
        case EmbeddedDriverError_Tags.StartupCancelled: {
          ordinalConverter.write(4, into);
          return;
        }
        case EmbeddedDriverError_Tags.StartupTimeout: {
          ordinalConverter.write(5, into);
          const inner = value.inner;
          FfiConverterUInt64.write(inner.timeoutMs, into);
          return;
        }
        case EmbeddedDriverError_Tags.ExitedBeforeReady: {
          ordinalConverter.write(6, into);
          const inner = value.inner;
          FfiConverterOptionalInt322.write(inner.code, into);
          return;
        }
        case EmbeddedDriverError_Tags.IncompatibleDaemon: {
          ordinalConverter.write(7, into);
          const inner = value.inner;
          FfiConverterString2.write(inner.reason, into);
          return;
        }
        case EmbeddedDriverError_Tags.Lifecycle: {
          ordinalConverter.write(8, into);
          const inner = value.inner;
          FfiConverterString2.write(inner.reason, into);
          return;
        }
        default:
          throw new UniffiInternalError.UnexpectedEnumCase();
      }
    }
    allocationSize(value) {
      switch (value.tag) {
        case EmbeddedDriverError_Tags.Configuration: {
          const inner = value.inner;
          let size = ordinalConverter.allocationSize(1);
          size += FfiConverterString2.allocationSize(inner.reason);
          return size;
        }
        case EmbeddedDriverError_Tags.EndpointConflict: {
          const inner = value.inner;
          let size = ordinalConverter.allocationSize(2);
          size += FfiConverterString2.allocationSize(inner.path);
          size += FfiConverterString2.allocationSize(inner.reason);
          return size;
        }
        case EmbeddedDriverError_Tags.Spawn: {
          const inner = value.inner;
          let size = ordinalConverter.allocationSize(3);
          size += FfiConverterString2.allocationSize(inner.binaryPath);
          size += FfiConverterString2.allocationSize(inner.reason);
          return size;
        }
        case EmbeddedDriverError_Tags.StartupCancelled: {
          return ordinalConverter.allocationSize(4);
        }
        case EmbeddedDriverError_Tags.StartupTimeout: {
          const inner = value.inner;
          let size = ordinalConverter.allocationSize(5);
          size += FfiConverterUInt64.allocationSize(inner.timeoutMs);
          return size;
        }
        case EmbeddedDriverError_Tags.ExitedBeforeReady: {
          const inner = value.inner;
          let size = ordinalConverter.allocationSize(6);
          size += FfiConverterOptionalInt322.allocationSize(inner.code);
          return size;
        }
        case EmbeddedDriverError_Tags.IncompatibleDaemon: {
          const inner = value.inner;
          let size = ordinalConverter.allocationSize(7);
          size += FfiConverterString2.allocationSize(inner.reason);
          return size;
        }
        case EmbeddedDriverError_Tags.Lifecycle: {
          const inner = value.inner;
          let size = ordinalConverter.allocationSize(8);
          size += FfiConverterString2.allocationSize(inner.reason);
          return size;
        }
        default:
          throw new UniffiInternalError.UnexpectedEnumCase();
      }
    }
  }
  return new FFIConverter();
})();
var EmbeddedDriverHostState;
(function(EmbeddedDriverHostState2) {
  EmbeddedDriverHostState2[EmbeddedDriverHostState2["Stopped"] = 0] = "Stopped";
  EmbeddedDriverHostState2[EmbeddedDriverHostState2["Starting"] = 1] = "Starting";
  EmbeddedDriverHostState2[EmbeddedDriverHostState2["Ready"] = 2] = "Ready";
  EmbeddedDriverHostState2[EmbeddedDriverHostState2["Stopping"] = 3] = "Stopping";
})(EmbeddedDriverHostState || (EmbeddedDriverHostState = {}));
var FfiConverterTypeEmbeddedDriverHostState = (() => {
  const ordinalConverter = FfiConverterInt32;
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      switch (ordinalConverter.read(from)) {
        case 1:
          return EmbeddedDriverHostState.Stopped;
        case 2:
          return EmbeddedDriverHostState.Starting;
        case 3:
          return EmbeddedDriverHostState.Ready;
        case 4:
          return EmbeddedDriverHostState.Stopping;
        default:
          throw new UniffiInternalError.UnexpectedEnumCase();
      }
    }
    write(value, into) {
      switch (value) {
        case EmbeddedDriverHostState.Stopped:
          return ordinalConverter.write(1, into);
        case EmbeddedDriverHostState.Starting:
          return ordinalConverter.write(2, into);
        case EmbeddedDriverHostState.Ready:
          return ordinalConverter.write(3, into);
        case EmbeddedDriverHostState.Stopping:
          return ordinalConverter.write(4, into);
      }
    }
    allocationSize(value) {
      return ordinalConverter.allocationSize(0);
    }
  }
  return new FFIConverter();
})();
var SdkClientKind;
(function(SdkClientKind2) {
  SdkClientKind2[SdkClientKind2["Python"] = 0] = "Python";
  SdkClientKind2[SdkClientKind2["Typescript"] = 1] = "Typescript";
})(SdkClientKind || (SdkClientKind = {}));
var FfiConverterTypeSdkClientKind = (() => {
  const ordinalConverter = FfiConverterInt32;
  class FFIConverter extends AbstractFfiConverterByteArray {
    read(from) {
      switch (ordinalConverter.read(from)) {
        case 1:
          return SdkClientKind.Python;
        case 2:
          return SdkClientKind.Typescript;
        default:
          throw new UniffiInternalError.UnexpectedEnumCase();
      }
    }
    write(value, into) {
      switch (value) {
        case SdkClientKind.Python:
          return ordinalConverter.write(1, into);
        case SdkClientKind.Typescript:
          return ordinalConverter.write(2, into);
      }
    }
    allocationSize(value) {
      return ordinalConverter.allocationSize(0);
    }
  }
  return new FFIConverter();
})();
var CuaDriver = class extends UniffiAbstractObject {
  [uniffiTypeNameSymbol] = "CuaDriver";
  [destructorGuardSymbol];
  [pointerLiteralSymbol];
  // No primary constructor declared for this class.
  constructor(pointer) {
    super();
    this[pointerLiteralSymbol] = pointer;
    this[destructorGuardSymbol] = uniffiTypeCuaDriverObjectFactory.bless(pointer);
  }
  /**
   * Connect to the default installed daemon or an explicitly selected socket.
   * This is the temporary compatibility path for released socket clients.
   */
  static connect(socketPath) {
    return FfiConverterTypeCuaDriver.lift(uniffiCaller2.rustCallWithError(
      /*liftError:*/
      FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError),
      /*caller:*/
      (callStatus) => {
        return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_constructor_cuadriver_connect(FfiConverterOptionalString2.lower(socketPath, cua_driver_sdk_ffi_default().rustbuffer_alloc), callStatus);
      },
      /*liftString:*/
      FfiConverterString2.lift.bind(FfiConverterString2)
    ));
  }
  /**
   * Language-package entry point that preserves the public `connect` API
   * while attaching a closed runtime category to daemon requests.
   */
  static connectWithClientKind(socketPath, clientKind) {
    return FfiConverterTypeCuaDriver.lift(uniffiCaller2.rustCallWithError(
      /*liftError:*/
      FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError),
      /*caller:*/
      (callStatus) => {
        return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_constructor_cuadriver_connect_with_client_kind(FfiConverterOptionalString2.lower(socketPath, cua_driver_sdk_ffi_default().rustbuffer_alloc), FfiConverterTypeSdkClientKind.lower(clientKind, cua_driver_sdk_ffi_default().rustbuffer_alloc), callStatus);
      },
      /*liftString:*/
      FfiConverterString2.lift.bind(FfiConverterString2)
    ));
  }
  /**
   * Create a same-process driver runtime. This constructor never launches
   * `cua-driver` and never opens daemon IPC.
   */
  static create(options) {
    return FfiConverterTypeCuaDriver.lift(uniffiCaller2.rustCallWithError(
      /*liftError:*/
      FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError),
      /*caller:*/
      (callStatus) => {
        return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_constructor_cuadriver_create(FfiConverterOptionalTypeDriverOptions.lower(options, cua_driver_sdk_ffi_default().rustbuffer_alloc), callStatus);
      },
      /*liftString:*/
      FfiConverterString2.lift.bind(FfiConverterString2)
    ));
  }
  /**
   * Create a same-process runtime with an explicit immutable authorization
   * ceiling. This is a trusted host constructor and is not exposed as an
   * agent tool. Existing `create()` callers remain unchanged.
   */
  static createConfigured(options) {
    return FfiConverterTypeCuaDriver.lift(uniffiCaller2.rustCallWithError(
      /*liftError:*/
      FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError),
      /*caller:*/
      (callStatus) => {
        return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_constructor_cuadriver_create_configured(FfiConverterTypeConfiguredDriverOptions.lower(options, cua_driver_sdk_ffi_default().rustbuffer_alloc), callStatus);
      },
      /*liftString:*/
      FfiConverterString2.lift.bind(FfiConverterString2)
    ));
  }
  /**
   * Create a configured same-process runtime with a content-free activity
   * observer supplied by trusted embedding-host code.
   */
  static createConfiguredWithActivityObserver(options, observer) {
    return FfiConverterTypeCuaDriver.lift(uniffiCaller2.rustCallWithError(
      /*liftError:*/
      FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError),
      /*caller:*/
      (callStatus) => {
        return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_constructor_cuadriver_create_configured_with_activity_observer(FfiConverterTypeConfiguredDriverOptions.lower(options, cua_driver_sdk_ffi_default().rustbuffer_alloc), FfiConverterTypeDriverActivityObserver.lower(observer, cua_driver_sdk_ffi_default().rustbuffer_alloc), callStatus);
      },
      /*liftString:*/
      FfiConverterString2.lift.bind(FfiConverterString2)
    ));
  }
  /**
   * Language-package entry point for a configured activity-observer runtime.
   */
  static createConfiguredWithActivityObserverAndClientKind(options, observer, clientKind) {
    return FfiConverterTypeCuaDriver.lift(uniffiCaller2.rustCallWithError(
      /*liftError:*/
      FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError),
      /*caller:*/
      (callStatus) => {
        return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_constructor_cuadriver_create_configured_with_activity_observer_and_client_kind(FfiConverterTypeConfiguredDriverOptions.lower(options, cua_driver_sdk_ffi_default().rustbuffer_alloc), FfiConverterTypeDriverActivityObserver.lower(observer, cua_driver_sdk_ffi_default().rustbuffer_alloc), FfiConverterTypeSdkClientKind.lower(clientKind, cua_driver_sdk_ffi_default().rustbuffer_alloc), callStatus);
      },
      /*liftString:*/
      FfiConverterString2.lift.bind(FfiConverterString2)
    ));
  }
  /**
   * Create a configured same-process runtime with an optional residual
   * authorization callback supplied by trusted embedding-host code.
   *
   * The callback object is immutable runtime configuration. Applications
   * must not expose it to an agent or implement it using ordinary MCP
   * elicitation, model-visible stdio, or an auto-accepting callback.
   */
  static createConfiguredWithAuthorizationHost(options, host) {
    return FfiConverterTypeCuaDriver.lift(uniffiCaller2.rustCallWithError(
      /*liftError:*/
      FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError),
      /*caller:*/
      (callStatus) => {
        return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_constructor_cuadriver_create_configured_with_authorization_host(FfiConverterTypeConfiguredDriverOptions.lower(options, cua_driver_sdk_ffi_default().rustbuffer_alloc), FfiConverterTypeDriverAuthorizationHost.lower(host, cua_driver_sdk_ffi_default().rustbuffer_alloc), callStatus);
      },
      /*liftString:*/
      FfiConverterString2.lift.bind(FfiConverterString2)
    ));
  }
  /**
   * Language-package entry point for a configured protected-host runtime.
   */
  static createConfiguredWithAuthorizationHostAndClientKind(options, host, clientKind) {
    return FfiConverterTypeCuaDriver.lift(uniffiCaller2.rustCallWithError(
      /*liftError:*/
      FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError),
      /*caller:*/
      (callStatus) => {
        return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_constructor_cuadriver_create_configured_with_authorization_host_and_client_kind(FfiConverterTypeConfiguredDriverOptions.lower(options, cua_driver_sdk_ffi_default().rustbuffer_alloc), FfiConverterTypeDriverAuthorizationHost.lower(host, cua_driver_sdk_ffi_default().rustbuffer_alloc), FfiConverterTypeSdkClientKind.lower(clientKind, cua_driver_sdk_ffi_default().rustbuffer_alloc), callStatus);
      },
      /*liftString:*/
      FfiConverterString2.lift.bind(FfiConverterString2)
    ));
  }
  /**
   * Language-package entry point for an explicitly configured runtime.
   */
  static createConfiguredWithClientKind(options, clientKind) {
    return FfiConverterTypeCuaDriver.lift(uniffiCaller2.rustCallWithError(
      /*liftError:*/
      FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError),
      /*caller:*/
      (callStatus) => {
        return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_constructor_cuadriver_create_configured_with_client_kind(FfiConverterTypeConfiguredDriverOptions.lower(options, cua_driver_sdk_ffi_default().rustbuffer_alloc), FfiConverterTypeSdkClientKind.lower(clientKind, cua_driver_sdk_ffi_default().rustbuffer_alloc), callStatus);
      },
      /*liftString:*/
      FfiConverterString2.lift.bind(FfiConverterString2)
    ));
  }
  /**
   * Create a configured same-process runtime with both residual
   * authorization and content-free activity callbacks.
   */
  static createConfiguredWithHostIntegrations(options, host, observer) {
    return FfiConverterTypeCuaDriver.lift(uniffiCaller2.rustCallWithError(
      /*liftError:*/
      FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError),
      /*caller:*/
      (callStatus) => {
        return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_constructor_cuadriver_create_configured_with_host_integrations(FfiConverterTypeConfiguredDriverOptions.lower(options, cua_driver_sdk_ffi_default().rustbuffer_alloc), FfiConverterTypeDriverAuthorizationHost.lower(host, cua_driver_sdk_ffi_default().rustbuffer_alloc), FfiConverterTypeDriverActivityObserver.lower(observer, cua_driver_sdk_ffi_default().rustbuffer_alloc), callStatus);
      },
      /*liftString:*/
      FfiConverterString2.lift.bind(FfiConverterString2)
    ));
  }
  /**
   * Language-package entry point for both trusted host callbacks.
   */
  static createConfiguredWithHostIntegrationsAndClientKind(options, host, observer, clientKind) {
    return FfiConverterTypeCuaDriver.lift(uniffiCaller2.rustCallWithError(
      /*liftError:*/
      FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError),
      /*caller:*/
      (callStatus) => {
        return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_constructor_cuadriver_create_configured_with_host_integrations_and_client_kind(FfiConverterTypeConfiguredDriverOptions.lower(options, cua_driver_sdk_ffi_default().rustbuffer_alloc), FfiConverterTypeDriverAuthorizationHost.lower(host, cua_driver_sdk_ffi_default().rustbuffer_alloc), FfiConverterTypeDriverActivityObserver.lower(observer, cua_driver_sdk_ffi_default().rustbuffer_alloc), FfiConverterTypeSdkClientKind.lower(clientKind, cua_driver_sdk_ffi_default().rustbuffer_alloc), callStatus);
      },
      /*liftString:*/
      FfiConverterString2.lift.bind(FfiConverterString2)
    ));
  }
  /**
   * Create a process-isolated runtime owned by this SDK object.
   *
   * This constructor directly spawns the supplied Cua Driver binary and
   * communicates only over inherited stdio. No daemon or reusable endpoint
   * is created.
   */
  static createPrivateWorker(options) {
    return FfiConverterTypeCuaDriver.lift(uniffiCaller2.rustCallWithError(
      /*liftError:*/
      FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError),
      /*caller:*/
      (callStatus) => {
        return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_constructor_cuadriver_create_private_worker(FfiConverterTypePrivateWorkerOptions.lower(options, cua_driver_sdk_ffi_default().rustbuffer_alloc), callStatus);
      },
      /*liftString:*/
      FfiConverterString2.lift.bind(FfiConverterString2)
    ));
  }
  /**
   * Language-package entry point that preserves the worker constructor
   * while attaching the importing SDK runtime category.
   */
  static createPrivateWorkerWithClientKind(options, clientKind) {
    return FfiConverterTypeCuaDriver.lift(uniffiCaller2.rustCallWithError(
      /*liftError:*/
      FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError),
      /*caller:*/
      (callStatus) => {
        return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_constructor_cuadriver_create_private_worker_with_client_kind(FfiConverterTypePrivateWorkerOptions.lower(options, cua_driver_sdk_ffi_default().rustbuffer_alloc), FfiConverterTypeSdkClientKind.lower(clientKind, cua_driver_sdk_ffi_default().rustbuffer_alloc), callStatus);
      },
      /*liftString:*/
      FfiConverterString2.lift.bind(FfiConverterString2)
    ));
  }
  /**
   * Language-package entry point for the same-process runtime. The wrapper
   * at each package root selects the client kind automatically.
   */
  static createWithClientKind(options, clientKind) {
    return FfiConverterTypeCuaDriver.lift(uniffiCaller2.rustCallWithError(
      /*liftError:*/
      FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError),
      /*caller:*/
      (callStatus) => {
        return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_constructor_cuadriver_create_with_client_kind(FfiConverterOptionalTypeDriverOptions.lower(options, cua_driver_sdk_ffi_default().rustbuffer_alloc), FfiConverterTypeSdkClientKind.lower(clientKind, cua_driver_sdk_ffi_default().rustbuffer_alloc), callStatus);
      },
      /*liftString:*/
      FfiConverterString2.lift.bind(FfiConverterString2)
    ));
  }
  /**
   * Generic protocol-adapter surface. Ordinary applications should prefer
   * typed methods; MCP and other open-ended adapters use this method so they
   * remain downstream of the same public SDK runtime.
   */
  async callTool(name, argumentsJson, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriver_call_tool(uniffiTypeCuaDriverObjectFactory.clonePointer(this), FfiConverterString2.lower(name, cua_driver_sdk_ffi_default().rustbuffer_alloc), FfiConverterString2.lower(argumentsJson, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeToolResult.lift.bind(FfiConverterTypeToolResult),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  async click(input, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriver_click(uniffiTypeCuaDriverObjectFactory.clonePointer(this), FfiConverterTypeClickInput2.lower(input, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeActionResult2.lift.bind(FfiConverterTypeActionResult2),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  async clipboardRead(input, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriver_clipboard_read(uniffiTypeCuaDriverObjectFactory.clonePointer(this), FfiConverterTypeClipboardReadInput2.lower(input, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeToolResult.lift.bind(FfiConverterTypeToolResult),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  async clipboardWrite(input, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriver_clipboard_write(uniffiTypeCuaDriverObjectFactory.clonePointer(this), FfiConverterTypeClipboardWriteInput2.lower(input, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeToolResult.lift.bind(FfiConverterTypeToolResult),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  async drag(input, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriver_drag(uniffiTypeCuaDriverObjectFactory.clonePointer(this), FfiConverterTypeDragInput2.lower(input, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeToolResult.lift.bind(FfiConverterTypeToolResult),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  async endSession(input, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriver_end_session(uniffiTypeCuaDriverObjectFactory.clonePointer(this), FfiConverterTypeEndSessionInput2.lower(input, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeEndSessionOutput2.lift.bind(FfiConverterTypeEndSessionOutput2),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  async escalateSession(input, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriver_escalate_session(uniffiTypeCuaDriverObjectFactory.clonePointer(this), FfiConverterTypeEscalateSessionInput2.lower(input, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeSessionStateOutput2.lift.bind(FfiConverterTypeSessionStateOutput2),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  executionMode() {
    return ((__rb) => {
      try {
        return FfiConverterTypeDriverExecutionMode.lift(__rb);
      } finally {
        cua_driver_sdk_ffi_default().rustbuffer_free(__rb);
      }
    })(uniffiCaller2.rustCall(
      /*caller:*/
      (callStatus) => {
        return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriver_execution_mode(uniffiTypeCuaDriverObjectFactory.clonePointer(this), callStatus);
      },
      /*liftString:*/
      FfiConverterString2.lift.bind(FfiConverterString2)
    ));
  }
  async getAgentCursorState(input, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriver_get_agent_cursor_state(uniffiTypeCuaDriverObjectFactory.clonePointer(this), FfiConverterTypeGetAgentCursorStateInput2.lower(input, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeToolResult.lift.bind(FfiConverterTypeToolResult),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  async getCursorPosition(input, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriver_get_cursor_position(uniffiTypeCuaDriverObjectFactory.clonePointer(this), FfiConverterTypeGetCursorPositionInput2.lower(input, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeToolResult.lift.bind(FfiConverterTypeToolResult),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  async getDesktopState(input, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriver_get_desktop_state(uniffiTypeCuaDriverObjectFactory.clonePointer(this), FfiConverterTypeGetDesktopStateInput2.lower(input, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeToolResult.lift.bind(FfiConverterTypeToolResult),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  async getScreenSize(input, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriver_get_screen_size(uniffiTypeCuaDriverObjectFactory.clonePointer(this), FfiConverterTypeGetScreenSizeInput2.lower(input, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeToolResult.lift.bind(FfiConverterTypeToolResult),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  async getSession(input, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriver_get_session(uniffiTypeCuaDriverObjectFactory.clonePointer(this), FfiConverterTypeGetSessionInput2.lower(input, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeSessionOutput2.lift.bind(FfiConverterTypeSessionOutput2),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  async getSessionState(input, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriver_get_session_state(uniffiTypeCuaDriverObjectFactory.clonePointer(this), FfiConverterTypeGetSessionStateInput2.lower(input, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeSessionStateOutput2.lift.bind(FfiConverterTypeSessionStateOutput2),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  async getWindowState(input, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriver_get_window_state(uniffiTypeCuaDriverObjectFactory.clonePointer(this), FfiConverterTypeGetWindowStateInput2.lower(input, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeWindowStateOutput2.lift.bind(FfiConverterTypeWindowStateOutput2),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  async hotkey(input, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriver_hotkey(uniffiTypeCuaDriverObjectFactory.clonePointer(this), FfiConverterTypeHotkeyInput2.lower(input, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeToolResult.lift.bind(FfiConverterTypeToolResult),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  async invokeMenu(input, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriver_invoke_menu(uniffiTypeCuaDriverObjectFactory.clonePointer(this), FfiConverterTypeInvokeMenuInput2.lower(input, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeToolResult.lift.bind(FfiConverterTypeToolResult),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  isAvailable() {
    return FfiConverterBool.lift(uniffiCaller2.rustCall(
      /*caller:*/
      (callStatus) => {
        return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriver_is_available(uniffiTypeCuaDriverObjectFactory.clonePointer(this), callStatus);
      },
      /*liftString:*/
      FfiConverterString2.lift.bind(FfiConverterString2)
    ));
  }
  async listApps(input, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriver_list_apps(uniffiTypeCuaDriverObjectFactory.clonePointer(this), FfiConverterTypeListAppsInput2.lower(input, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeListAppsOutput2.lift.bind(FfiConverterTypeListAppsOutput2),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  /**
   * Content-free lifecycle summaries for the trusted host's runtime or
   * host-lease namespace. This is deliberately separate from the
   * agent-facing `list_sessions` tool, whose view is transport scoped.
   */
  async listHostSessionsJson(asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriver_list_host_sessions_json(uniffiTypeCuaDriverObjectFactory.clonePointer(this));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  async listSessions(input, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriver_list_sessions(uniffiTypeCuaDriverObjectFactory.clonePointer(this), FfiConverterTypeListSessionsInput2.lower(input, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeListSessionsOutput2.lift.bind(FfiConverterTypeListSessionsOutput2),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  /**
   * Canonical tool inventory for MCP and other protocol adapters.
   */
  async listToolsJson(asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriver_list_tools_json(uniffiTypeCuaDriverObjectFactory.clonePointer(this));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  async listWindows(input, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriver_list_windows(uniffiTypeCuaDriverObjectFactory.clonePointer(this), FfiConverterTypeListWindowsInput2.lower(input, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeListWindowsOutput2.lift.bind(FfiConverterTypeListWindowsOutput2),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  async metadata(asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriver_metadata(uniffiTypeCuaDriverObjectFactory.clonePointer(this));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeDriverMetadata.lift.bind(FfiConverterTypeDriverMetadata),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  async moveCursor(input, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriver_move_cursor(uniffiTypeCuaDriverObjectFactory.clonePointer(this), FfiConverterTypeMoveCursorInput2.lower(input, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeToolResult.lift.bind(FfiConverterTypeToolResult),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  async pressKey(input, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriver_press_key(uniffiTypeCuaDriverObjectFactory.clonePointer(this), FfiConverterTypePressKeyInput2.lower(input, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeToolResult.lift.bind(FfiConverterTypeToolResult),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  runtimeScopePrefix() {
    return ((__rb) => {
      try {
        return FfiConverterOptionalString2.lift(__rb);
      } finally {
        cua_driver_sdk_ffi_default().rustbuffer_free(__rb);
      }
    })(uniffiCaller2.rustCall(
      /*caller:*/
      (callStatus) => {
        return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriver_runtime_scope_prefix(uniffiTypeCuaDriverObjectFactory.clonePointer(this), callStatus);
      },
      /*liftString:*/
      FfiConverterString2.lift.bind(FfiConverterString2)
    ));
  }
  async scroll(input, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriver_scroll(uniffiTypeCuaDriverObjectFactory.clonePointer(this), FfiConverterTypeScrollInput2.lower(input, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeToolResult.lift.bind(FfiConverterTypeToolResult),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  async setAgentCursorEnabled(input, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriver_set_agent_cursor_enabled(uniffiTypeCuaDriverObjectFactory.clonePointer(this), FfiConverterTypeSetAgentCursorEnabledInput2.lower(input, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeToolResult.lift.bind(FfiConverterTypeToolResult),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  async setAgentCursorMotion(input, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriver_set_agent_cursor_motion(uniffiTypeCuaDriverObjectFactory.clonePointer(this), FfiConverterTypeSetAgentCursorMotionInput2.lower(input, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeToolResult.lift.bind(FfiConverterTypeToolResult),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  async setAgentCursorTheme(input, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriver_set_agent_cursor_theme(uniffiTypeCuaDriverObjectFactory.clonePointer(this), FfiConverterTypeSetAgentCursorThemeInput2.lower(input, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeToolResult.lift.bind(FfiConverterTypeToolResult),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  async setWindowFrame(input, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriver_set_window_frame(uniffiTypeCuaDriverObjectFactory.clonePointer(this), FfiConverterTypeSetWindowFrameInput2.lower(input, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeToolResult.lift.bind(FfiConverterTypeToolResult),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  /**
   * Stop accepting new embedded operations. Repeated calls are harmless;
   * daemon compatibility clients do not own the daemon and therefore no-op.
   */
  async shutdown(asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriver_shutdown(uniffiTypeCuaDriverObjectFactory.clonePointer(this));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_void,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_void,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_void,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_void,
        /*liftFunc:*/
        (_v) => {
        },
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  /**
   * Compatibility accessor. Embedded runtimes have no socket and return an
   * empty string; new code should branch on [`Self::execution_mode`].
   */
  socketPath() {
    return ((__rb) => {
      try {
        return FfiConverterString2.lift(__rb);
      } finally {
        cua_driver_sdk_ffi_default().rustbuffer_free(__rb);
      }
    })(uniffiCaller2.rustCall(
      /*caller:*/
      (callStatus) => {
        return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriver_socket_path(uniffiTypeCuaDriverObjectFactory.clonePointer(this), callStatus);
      },
      /*liftString:*/
      FfiConverterString2.lift.bind(FfiConverterString2)
    ));
  }
  async startSession(input, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriver_start_session(uniffiTypeCuaDriverObjectFactory.clonePointer(this), FfiConverterTypeStartSessionInput2.lower(input, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeStartSessionOutput2.lift.bind(FfiConverterTypeStartSessionOutput2),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  async typeText(input, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriver_type_text(uniffiTypeCuaDriverObjectFactory.clonePointer(this), FfiConverterTypeTypeTextInput2.lower(input, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeToolResult.lift.bind(FfiConverterTypeToolResult),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  async verifyState(input, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriver_verify_state(uniffiTypeCuaDriverObjectFactory.clonePointer(this), FfiConverterTypeVerifyStateInput2.lower(input, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeToolResult.lift.bind(FfiConverterTypeToolResult),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  uniffiDestroy() {
    const ptr = this[destructorGuardSymbol];
    if (ptr !== void 0) {
      const pointer = uniffiTypeCuaDriverObjectFactory.pointer(this);
      uniffiTypeCuaDriverObjectFactory.freePointer(pointer);
      uniffiTypeCuaDriverObjectFactory.unbless(ptr);
      delete this[destructorGuardSymbol];
    }
  }
  static instanceOf(obj_) {
    return uniffiTypeCuaDriverObjectFactory.isConcreteType(obj_);
  }
};
var uniffiTypeCuaDriverObjectFactory = (() => {
  const registry = typeof FinalizationRegistry !== "undefined" ? new FinalizationRegistry((heldValue) => {
    uniffiTypeCuaDriverObjectFactory.freePointer(heldValue);
  }) : null;
  return {
    create(pointer) {
      const instance = Object.create(CuaDriver.prototype);
      instance[pointerLiteralSymbol] = pointer;
      instance[destructorGuardSymbol] = this.bless(pointer);
      instance[uniffiTypeNameSymbol] = "CuaDriver";
      return instance;
    },
    bless(p) {
      const ptr = {
        p,
        // make sure this object doesn't get optimized away.
        markDestroyed: () => void 0
      };
      if (registry) {
        registry.register(ptr, p, ptr);
      }
      return ptr;
    },
    unbless(ptr_) {
      if (registry) {
        registry.unregister(ptr_);
      }
    },
    pointer(obj_) {
      if (obj_[destructorGuardSymbol] === void 0) {
        throw new UniffiInternalError.UnexpectedNullPointer();
      }
      return obj_[pointerLiteralSymbol];
    },
    clonePointer(obj_) {
      const pointer = this.pointer(obj_);
      return uniffiCaller2.rustCall(
        /*caller:*/
        (callStatus) => cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_clone_cuadriver(pointer, callStatus),
        /*liftString:*/
        FfiConverterString2.lift
      );
    },
    freePointer(pointer) {
      uniffiCaller2.rustCall(
        /*caller:*/
        (callStatus) => cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_free_cuadriver(pointer, callStatus),
        /*liftString:*/
        FfiConverterString2.lift
      );
    },
    isConcreteType(obj_) {
      return obj_[destructorGuardSymbol] && obj_[uniffiTypeNameSymbol] === "CuaDriver";
    }
  };
})();
var FfiConverterTypeCuaDriver = new FfiConverterObject(uniffiTypeCuaDriverObjectFactory);
var CuaDriverSession = class extends UniffiAbstractObject {
  [uniffiTypeNameSymbol] = "CuaDriverSession";
  [destructorGuardSymbol];
  [pointerLiteralSymbol];
  // No primary constructor declared for this class.
  constructor(pointer) {
    super();
    this[pointerLiteralSymbol] = pointer;
    this[destructorGuardSymbol] = uniffiTypeCuaDriverSessionObjectFactory.bless(pointer);
  }
  async callTool(name, argumentsJson, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriversession_call_tool(uniffiTypeCuaDriverSessionObjectFactory.clonePointer(this), FfiConverterString2.lower(name, cua_driver_sdk_ffi_default().rustbuffer_alloc), FfiConverterString2.lower(argumentsJson, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeToolResult.lift.bind(FfiConverterTypeToolResult),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  async click(input, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriversession_click(uniffiTypeCuaDriverSessionObjectFactory.clonePointer(this), FfiConverterTypeClickInput2.lower(input, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeActionResult2.lift.bind(FfiConverterTypeActionResult2),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  async clipboardRead(input, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriversession_clipboard_read(uniffiTypeCuaDriverSessionObjectFactory.clonePointer(this), FfiConverterTypeClipboardReadInput2.lower(input, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeToolResult.lift.bind(FfiConverterTypeToolResult),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  async clipboardWrite(input, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriversession_clipboard_write(uniffiTypeCuaDriverSessionObjectFactory.clonePointer(this), FfiConverterTypeClipboardWriteInput2.lower(input, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeToolResult.lift.bind(FfiConverterTypeToolResult),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  /**
   * Revoke the session-bound authority and release its native handle.
   *
   * This operation is idempotent. Dropping the object performs the same
   * cleanup, but trusted hosts should call it at their lifecycle boundary.
   */
  close() {
    uniffiCaller2.rustCall(
      /*caller:*/
      (callStatus) => {
        cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriversession_close(uniffiTypeCuaDriverSessionObjectFactory.clonePointer(this), callStatus);
      },
      /*liftString:*/
      FfiConverterString2.lift.bind(FfiConverterString2)
    );
  }
  async drag(input, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriversession_drag(uniffiTypeCuaDriverSessionObjectFactory.clonePointer(this), FfiConverterTypeDragInput2.lower(input, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeToolResult.lift.bind(FfiConverterTypeToolResult),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  async endSession(input, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriversession_end_session(uniffiTypeCuaDriverSessionObjectFactory.clonePointer(this), FfiConverterTypeEndSessionInput2.lower(input, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeEndSessionOutput2.lift.bind(FfiConverterTypeEndSessionOutput2),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  async escalateSession(input, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriversession_escalate_session(uniffiTypeCuaDriverSessionObjectFactory.clonePointer(this), FfiConverterTypeEscalateSessionInput2.lower(input, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeSessionStateOutput2.lift.bind(FfiConverterTypeSessionStateOutput2),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  async getAgentCursorState(input, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriversession_get_agent_cursor_state(uniffiTypeCuaDriverSessionObjectFactory.clonePointer(this), FfiConverterTypeGetAgentCursorStateInput2.lower(input, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeToolResult.lift.bind(FfiConverterTypeToolResult),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  async getCursorPosition(input, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriversession_get_cursor_position(uniffiTypeCuaDriverSessionObjectFactory.clonePointer(this), FfiConverterTypeGetCursorPositionInput2.lower(input, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeToolResult.lift.bind(FfiConverterTypeToolResult),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  async getDesktopState(input, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriversession_get_desktop_state(uniffiTypeCuaDriverSessionObjectFactory.clonePointer(this), FfiConverterTypeGetDesktopStateInput2.lower(input, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeToolResult.lift.bind(FfiConverterTypeToolResult),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  async getScreenSize(input, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriversession_get_screen_size(uniffiTypeCuaDriverSessionObjectFactory.clonePointer(this), FfiConverterTypeGetScreenSizeInput2.lower(input, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeToolResult.lift.bind(FfiConverterTypeToolResult),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  async getSession(input, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriversession_get_session(uniffiTypeCuaDriverSessionObjectFactory.clonePointer(this), FfiConverterTypeGetSessionInput2.lower(input, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeSessionOutput2.lift.bind(FfiConverterTypeSessionOutput2),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  async getSessionState(input, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriversession_get_session_state(uniffiTypeCuaDriverSessionObjectFactory.clonePointer(this), FfiConverterTypeGetSessionStateInput2.lower(input, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeSessionStateOutput2.lift.bind(FfiConverterTypeSessionStateOutput2),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  async getWindowState(input, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriversession_get_window_state(uniffiTypeCuaDriverSessionObjectFactory.clonePointer(this), FfiConverterTypeGetWindowStateInput2.lower(input, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeWindowStateOutput2.lift.bind(FfiConverterTypeWindowStateOutput2),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  async hotkey(input, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriversession_hotkey(uniffiTypeCuaDriverSessionObjectFactory.clonePointer(this), FfiConverterTypeHotkeyInput2.lower(input, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeToolResult.lift.bind(FfiConverterTypeToolResult),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  async invokeMenu(input, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriversession_invoke_menu(uniffiTypeCuaDriverSessionObjectFactory.clonePointer(this), FfiConverterTypeInvokeMenuInput2.lower(input, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeToolResult.lift.bind(FfiConverterTypeToolResult),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  async listApps(input, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriversession_list_apps(uniffiTypeCuaDriverSessionObjectFactory.clonePointer(this), FfiConverterTypeListAppsInput2.lower(input, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeListAppsOutput2.lift.bind(FfiConverterTypeListAppsOutput2),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  async listSessions(input, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriversession_list_sessions(uniffiTypeCuaDriverSessionObjectFactory.clonePointer(this), FfiConverterTypeListSessionsInput2.lower(input, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeListSessionsOutput2.lift.bind(FfiConverterTypeListSessionsOutput2),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  async listWindows(input, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriversession_list_windows(uniffiTypeCuaDriverSessionObjectFactory.clonePointer(this), FfiConverterTypeListWindowsInput2.lower(input, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeListWindowsOutput2.lift.bind(FfiConverterTypeListWindowsOutput2),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  async moveCursor(input, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriversession_move_cursor(uniffiTypeCuaDriverSessionObjectFactory.clonePointer(this), FfiConverterTypeMoveCursorInput2.lower(input, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeToolResult.lift.bind(FfiConverterTypeToolResult),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  async pressKey(input, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriversession_press_key(uniffiTypeCuaDriverSessionObjectFactory.clonePointer(this), FfiConverterTypePressKeyInput2.lower(input, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeToolResult.lift.bind(FfiConverterTypeToolResult),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  async scroll(input, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriversession_scroll(uniffiTypeCuaDriverSessionObjectFactory.clonePointer(this), FfiConverterTypeScrollInput2.lower(input, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeToolResult.lift.bind(FfiConverterTypeToolResult),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  async setAgentCursorEnabled(input, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriversession_set_agent_cursor_enabled(uniffiTypeCuaDriverSessionObjectFactory.clonePointer(this), FfiConverterTypeSetAgentCursorEnabledInput2.lower(input, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeToolResult.lift.bind(FfiConverterTypeToolResult),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  async setAgentCursorMotion(input, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriversession_set_agent_cursor_motion(uniffiTypeCuaDriverSessionObjectFactory.clonePointer(this), FfiConverterTypeSetAgentCursorMotionInput2.lower(input, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeToolResult.lift.bind(FfiConverterTypeToolResult),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  async setAgentCursorTheme(input, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriversession_set_agent_cursor_theme(uniffiTypeCuaDriverSessionObjectFactory.clonePointer(this), FfiConverterTypeSetAgentCursorThemeInput2.lower(input, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeToolResult.lift.bind(FfiConverterTypeToolResult),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  async setWindowFrame(input, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriversession_set_window_frame(uniffiTypeCuaDriverSessionObjectFactory.clonePointer(this), FfiConverterTypeSetWindowFrameInput2.lower(input, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeToolResult.lift.bind(FfiConverterTypeToolResult),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  async startSession(input, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriversession_start_session(uniffiTypeCuaDriverSessionObjectFactory.clonePointer(this), FfiConverterTypeStartSessionInput2.lower(input, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeStartSessionOutput2.lift.bind(FfiConverterTypeStartSessionOutput2),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  async typeText(input, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriversession_type_text(uniffiTypeCuaDriverSessionObjectFactory.clonePointer(this), FfiConverterTypeTypeTextInput2.lower(input, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeToolResult.lift.bind(FfiConverterTypeToolResult),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  async verifyState(input, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_cuadriversession_verify_state(uniffiTypeCuaDriverSessionObjectFactory.clonePointer(this), FfiConverterTypeVerifyStateInput2.lower(input, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeToolResult.lift.bind(FfiConverterTypeToolResult),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  uniffiDestroy() {
    const ptr = this[destructorGuardSymbol];
    if (ptr !== void 0) {
      const pointer = uniffiTypeCuaDriverSessionObjectFactory.pointer(this);
      uniffiTypeCuaDriverSessionObjectFactory.freePointer(pointer);
      uniffiTypeCuaDriverSessionObjectFactory.unbless(ptr);
      delete this[destructorGuardSymbol];
    }
  }
  static instanceOf(obj_) {
    return uniffiTypeCuaDriverSessionObjectFactory.isConcreteType(obj_);
  }
};
var uniffiTypeCuaDriverSessionObjectFactory = (() => {
  const registry = typeof FinalizationRegistry !== "undefined" ? new FinalizationRegistry((heldValue) => {
    uniffiTypeCuaDriverSessionObjectFactory.freePointer(heldValue);
  }) : null;
  return {
    create(pointer) {
      const instance = Object.create(CuaDriverSession.prototype);
      instance[pointerLiteralSymbol] = pointer;
      instance[destructorGuardSymbol] = this.bless(pointer);
      instance[uniffiTypeNameSymbol] = "CuaDriverSession";
      return instance;
    },
    bless(p) {
      const ptr = {
        p,
        // make sure this object doesn't get optimized away.
        markDestroyed: () => void 0
      };
      if (registry) {
        registry.register(ptr, p, ptr);
      }
      return ptr;
    },
    unbless(ptr_) {
      if (registry) {
        registry.unregister(ptr_);
      }
    },
    pointer(obj_) {
      if (obj_[destructorGuardSymbol] === void 0) {
        throw new UniffiInternalError.UnexpectedNullPointer();
      }
      return obj_[pointerLiteralSymbol];
    },
    clonePointer(obj_) {
      const pointer = this.pointer(obj_);
      return uniffiCaller2.rustCall(
        /*caller:*/
        (callStatus) => cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_clone_cuadriversession(pointer, callStatus),
        /*liftString:*/
        FfiConverterString2.lift
      );
    },
    freePointer(pointer) {
      uniffiCaller2.rustCall(
        /*caller:*/
        (callStatus) => cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_free_cuadriversession(pointer, callStatus),
        /*liftString:*/
        FfiConverterString2.lift
      );
    },
    isConcreteType(obj_) {
      return obj_[destructorGuardSymbol] && obj_[uniffiTypeNameSymbol] === "CuaDriverSession";
    }
  };
})();
var FfiConverterTypeCuaDriverSession = new FfiConverterObject(uniffiTypeCuaDriverSessionObjectFactory);
var DriverActivityObserverImpl = class extends UniffiAbstractObject {
  [uniffiTypeNameSymbol] = "DriverActivityObserverImpl";
  [destructorGuardSymbol];
  [pointerLiteralSymbol];
  // No primary constructor declared for this class.
  constructor(pointer) {
    super();
    this[pointerLiteralSymbol] = pointer;
    this[destructorGuardSymbol] = uniffiTypeDriverActivityObserverImplObjectFactory.bless(pointer);
  }
  onActivity(event) {
    uniffiCaller2.rustCall(
      /*caller:*/
      (callStatus) => {
        cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_driveractivityobserver_on_activity(uniffiTypeDriverActivityObserverImplObjectFactory.clonePointer(this), FfiConverterTypeDriverActivityEvent.lower(event, cua_driver_sdk_ffi_default().rustbuffer_alloc), callStatus);
      },
      /*liftString:*/
      FfiConverterString2.lift.bind(FfiConverterString2)
    );
  }
  uniffiDestroy() {
    const ptr = this[destructorGuardSymbol];
    if (ptr !== void 0) {
      const pointer = uniffiTypeDriverActivityObserverImplObjectFactory.pointer(this);
      uniffiTypeDriverActivityObserverImplObjectFactory.freePointer(pointer);
      uniffiTypeDriverActivityObserverImplObjectFactory.unbless(ptr);
      delete this[destructorGuardSymbol];
    }
  }
  static instanceOf(obj_) {
    return uniffiTypeDriverActivityObserverImplObjectFactory.isConcreteType(obj_);
  }
};
var uniffiTypeDriverActivityObserverImplObjectFactory = (() => {
  const registry = typeof FinalizationRegistry !== "undefined" ? new FinalizationRegistry((heldValue) => {
    uniffiTypeDriverActivityObserverImplObjectFactory.freePointer(heldValue);
  }) : null;
  return {
    create(pointer) {
      const instance = Object.create(DriverActivityObserverImpl.prototype);
      instance[pointerLiteralSymbol] = pointer;
      instance[destructorGuardSymbol] = this.bless(pointer);
      instance[uniffiTypeNameSymbol] = "DriverActivityObserverImpl";
      return instance;
    },
    bless(p) {
      const ptr = {
        p,
        // make sure this object doesn't get optimized away.
        markDestroyed: () => void 0
      };
      if (registry) {
        registry.register(ptr, p, ptr);
      }
      return ptr;
    },
    unbless(ptr_) {
      if (registry) {
        registry.unregister(ptr_);
      }
    },
    pointer(obj_) {
      if (obj_[destructorGuardSymbol] === void 0) {
        throw new UniffiInternalError.UnexpectedNullPointer();
      }
      return obj_[pointerLiteralSymbol];
    },
    clonePointer(obj_) {
      const pointer = this.pointer(obj_);
      return uniffiCaller2.rustCall(
        /*caller:*/
        (callStatus) => cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_clone_driveractivityobserver(pointer, callStatus),
        /*liftString:*/
        FfiConverterString2.lift
      );
    },
    freePointer(pointer) {
      uniffiCaller2.rustCall(
        /*caller:*/
        (callStatus) => cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_free_driveractivityobserver(pointer, callStatus),
        /*liftString:*/
        FfiConverterString2.lift
      );
    },
    isConcreteType(obj_) {
      return obj_[destructorGuardSymbol] && obj_[uniffiTypeNameSymbol] === "DriverActivityObserverImpl";
    }
  };
})();
var FfiConverterTypeDriverActivityObserver = new FfiConverterObjectWithCallbacks(uniffiTypeDriverActivityObserverImplObjectFactory);
var uniffiCallbackInterfaceDriverActivityObserver = {
  // Create the VTable using a series of closures.
  // ts automatically converts these into C callback functions.
  vtable: {
    on_activity: (uniffiHandle, event) => {
      const uniffiMakeCall = () => {
        const jsCallback = FfiConverterTypeDriverActivityObserver.lift(uniffiHandle);
        return jsCallback.onActivity(FfiConverterTypeDriverActivityEvent.lift(event));
      };
      const uniffiResult = UniffiResult.ready();
      const uniffiHandleSuccess = (obj) => {
      };
      const uniffiHandleError = (code, errBuf) => {
        UniffiResult.writeError(uniffiResult, code, errBuf);
      };
      uniffiTraitInterfaceCall(
        /*makeCall:*/
        uniffiMakeCall,
        /*handleSuccess:*/
        uniffiHandleSuccess,
        /*handleError:*/
        uniffiHandleError,
        /*lowerString:*/
        FfiConverterString2.lower.bind(FfiConverterString2),
        /*alloc:*/
        cua_driver_sdk_ffi_default().rustbuffer_alloc
      );
      return uniffiResult;
    },
    uniffi_free: (uniffiHandle) => {
      FfiConverterTypeDriverActivityObserver.drop(uniffiHandle);
    },
    uniffi_clone: (uniffiHandle) => {
      return FfiConverterTypeDriverActivityObserver.clone(uniffiHandle);
    }
  },
  register: () => {
    cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_init_callback_vtable_driveractivityobserver(uniffiCallbackInterfaceDriverActivityObserver.vtable);
  }
};
var DriverAuthorizationHostImpl = class extends UniffiAbstractObject {
  [uniffiTypeNameSymbol] = "DriverAuthorizationHostImpl";
  [destructorGuardSymbol];
  [pointerLiteralSymbol];
  // No primary constructor declared for this class.
  constructor(pointer) {
    super();
    this[pointerLiteralSymbol] = pointer;
    this[destructorGuardSymbol] = uniffiTypeDriverAuthorizationHostImplObjectFactory.bless(pointer);
  }
  async authorize(request, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_driverauthorizationhost_authorize(uniffiTypeDriverAuthorizationHostImplObjectFactory.clonePointer(this), FfiConverterTypeDriverAuthorizationRequest.lower(request, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeDriverAuthorizationDecision.lift.bind(FfiConverterTypeDriverAuthorizationDecision),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverAuthorizationHostError.lift.bind(FfiConverterTypeDriverAuthorizationHostError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  uniffiDestroy() {
    const ptr = this[destructorGuardSymbol];
    if (ptr !== void 0) {
      const pointer = uniffiTypeDriverAuthorizationHostImplObjectFactory.pointer(this);
      uniffiTypeDriverAuthorizationHostImplObjectFactory.freePointer(pointer);
      uniffiTypeDriverAuthorizationHostImplObjectFactory.unbless(ptr);
      delete this[destructorGuardSymbol];
    }
  }
  static instanceOf(obj_) {
    return uniffiTypeDriverAuthorizationHostImplObjectFactory.isConcreteType(obj_);
  }
};
var uniffiTypeDriverAuthorizationHostImplObjectFactory = (() => {
  const registry = typeof FinalizationRegistry !== "undefined" ? new FinalizationRegistry((heldValue) => {
    uniffiTypeDriverAuthorizationHostImplObjectFactory.freePointer(heldValue);
  }) : null;
  return {
    create(pointer) {
      const instance = Object.create(DriverAuthorizationHostImpl.prototype);
      instance[pointerLiteralSymbol] = pointer;
      instance[destructorGuardSymbol] = this.bless(pointer);
      instance[uniffiTypeNameSymbol] = "DriverAuthorizationHostImpl";
      return instance;
    },
    bless(p) {
      const ptr = {
        p,
        // make sure this object doesn't get optimized away.
        markDestroyed: () => void 0
      };
      if (registry) {
        registry.register(ptr, p, ptr);
      }
      return ptr;
    },
    unbless(ptr_) {
      if (registry) {
        registry.unregister(ptr_);
      }
    },
    pointer(obj_) {
      if (obj_[destructorGuardSymbol] === void 0) {
        throw new UniffiInternalError.UnexpectedNullPointer();
      }
      return obj_[pointerLiteralSymbol];
    },
    clonePointer(obj_) {
      const pointer = this.pointer(obj_);
      return uniffiCaller2.rustCall(
        /*caller:*/
        (callStatus) => cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_clone_driverauthorizationhost(pointer, callStatus),
        /*liftString:*/
        FfiConverterString2.lift
      );
    },
    freePointer(pointer) {
      uniffiCaller2.rustCall(
        /*caller:*/
        (callStatus) => cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_free_driverauthorizationhost(pointer, callStatus),
        /*liftString:*/
        FfiConverterString2.lift
      );
    },
    isConcreteType(obj_) {
      return obj_[destructorGuardSymbol] && obj_[uniffiTypeNameSymbol] === "DriverAuthorizationHostImpl";
    }
  };
})();
var FfiConverterTypeDriverAuthorizationHost = new FfiConverterObjectWithCallbacks(uniffiTypeDriverAuthorizationHostImplObjectFactory);
var uniffiCallbackInterfaceDriverAuthorizationHost = {
  // Create the VTable using a series of closures.
  // ts automatically converts these into C callback functions.
  vtable: {
    authorize: (uniffiHandle, request, uniffiFutureCallback, uniffiCallbackData) => {
      const uniffiMakeCall = async (signal) => {
        const jsCallback = FfiConverterTypeDriverAuthorizationHost.lift(uniffiHandle);
        return await jsCallback.authorize(FfiConverterTypeDriverAuthorizationRequest.lift(request), { signal });
      };
      const uniffiHandleSuccess = (returnValue) => {
        uniffiFutureCallback.call(
          uniffiFutureCallback,
          uniffiCallbackData,
          /* UniffiForeignFutureResultRustBuffer */
          {
            return_value: FfiConverterTypeDriverAuthorizationDecision.lower(returnValue, cua_driver_sdk_ffi_default().rustbuffer_alloc),
            call_status: uniffiCaller2.createCallStatus()
          }
        );
      };
      const uniffiHandleError = (code, errorBuf) => {
        uniffiFutureCallback.call(
          uniffiFutureCallback,
          uniffiCallbackData,
          /* UniffiForeignFutureResultRustBuffer */
          {
            return_value: (
              /*empty*/
              new Uint8Array(0)
            ),
            // TODO create callstatus with error.
            call_status: uniffiCaller2.createErrorStatus(code, errorBuf)
          }
        );
      };
      const uniffiForeignFuture = uniffiTraitInterfaceCallAsyncWithError(
        /*makeCall:*/
        uniffiMakeCall,
        /*handleSuccess:*/
        uniffiHandleSuccess,
        /*handleError:*/
        uniffiHandleError,
        /*isErrorType:*/
        DriverAuthorizationHostError.instanceOf,
        /*lowerError:*/
        FfiConverterTypeDriverAuthorizationHostError.lower.bind(FfiConverterTypeDriverAuthorizationHostError),
        /*lowerString:*/
        FfiConverterString2.lower.bind(FfiConverterString2),
        /*alloc:*/
        cua_driver_sdk_ffi_default().rustbuffer_alloc
      );
      return uniffiForeignFuture;
    },
    uniffi_free: (uniffiHandle) => {
      FfiConverterTypeDriverAuthorizationHost.drop(uniffiHandle);
    },
    uniffi_clone: (uniffiHandle) => {
      return FfiConverterTypeDriverAuthorizationHost.clone(uniffiHandle);
    }
  },
  register: () => {
    cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_init_callback_vtable_driverauthorizationhost(uniffiCallbackInterfaceDriverAuthorizationHost.vtable);
  }
};
var DriverServiceTransportImpl = class extends UniffiAbstractObject {
  [uniffiTypeNameSymbol] = "DriverServiceTransportImpl";
  [destructorGuardSymbol];
  [pointerLiteralSymbol];
  // No primary constructor declared for this class.
  constructor(pointer) {
    super();
    this[pointerLiteralSymbol] = pointer;
    this[destructorGuardSymbol] = uniffiTypeDriverServiceTransportImplObjectFactory.bless(pointer);
  }
  async send(request, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_driverservicetransport_send(uniffiTypeDriverServiceTransportImplObjectFactory.clonePointer(this), FfiConverterTypeDriverServiceRequest.lower(request, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeDriverServiceResponse.lift.bind(FfiConverterTypeDriverServiceResponse),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverServiceTransportError.lift.bind(FfiConverterTypeDriverServiceTransportError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  uniffiDestroy() {
    const ptr = this[destructorGuardSymbol];
    if (ptr !== void 0) {
      const pointer = uniffiTypeDriverServiceTransportImplObjectFactory.pointer(this);
      uniffiTypeDriverServiceTransportImplObjectFactory.freePointer(pointer);
      uniffiTypeDriverServiceTransportImplObjectFactory.unbless(ptr);
      delete this[destructorGuardSymbol];
    }
  }
  static instanceOf(obj_) {
    return uniffiTypeDriverServiceTransportImplObjectFactory.isConcreteType(obj_);
  }
};
var uniffiTypeDriverServiceTransportImplObjectFactory = (() => {
  const registry = typeof FinalizationRegistry !== "undefined" ? new FinalizationRegistry((heldValue) => {
    uniffiTypeDriverServiceTransportImplObjectFactory.freePointer(heldValue);
  }) : null;
  return {
    create(pointer) {
      const instance = Object.create(DriverServiceTransportImpl.prototype);
      instance[pointerLiteralSymbol] = pointer;
      instance[destructorGuardSymbol] = this.bless(pointer);
      instance[uniffiTypeNameSymbol] = "DriverServiceTransportImpl";
      return instance;
    },
    bless(p) {
      const ptr = {
        p,
        // make sure this object doesn't get optimized away.
        markDestroyed: () => void 0
      };
      if (registry) {
        registry.register(ptr, p, ptr);
      }
      return ptr;
    },
    unbless(ptr_) {
      if (registry) {
        registry.unregister(ptr_);
      }
    },
    pointer(obj_) {
      if (obj_[destructorGuardSymbol] === void 0) {
        throw new UniffiInternalError.UnexpectedNullPointer();
      }
      return obj_[pointerLiteralSymbol];
    },
    clonePointer(obj_) {
      const pointer = this.pointer(obj_);
      return uniffiCaller2.rustCall(
        /*caller:*/
        (callStatus) => cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_clone_driverservicetransport(pointer, callStatus),
        /*liftString:*/
        FfiConverterString2.lift
      );
    },
    freePointer(pointer) {
      uniffiCaller2.rustCall(
        /*caller:*/
        (callStatus) => cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_free_driverservicetransport(pointer, callStatus),
        /*liftString:*/
        FfiConverterString2.lift
      );
    },
    isConcreteType(obj_) {
      return obj_[destructorGuardSymbol] && obj_[uniffiTypeNameSymbol] === "DriverServiceTransportImpl";
    }
  };
})();
var FfiConverterTypeDriverServiceTransport = new FfiConverterObjectWithCallbacks(uniffiTypeDriverServiceTransportImplObjectFactory);
var uniffiCallbackInterfaceDriverServiceTransport = {
  // Create the VTable using a series of closures.
  // ts automatically converts these into C callback functions.
  vtable: {
    send: (uniffiHandle, request, uniffiFutureCallback, uniffiCallbackData) => {
      const uniffiMakeCall = async (signal) => {
        const jsCallback = FfiConverterTypeDriverServiceTransport.lift(uniffiHandle);
        return await jsCallback.send(FfiConverterTypeDriverServiceRequest.lift(request), { signal });
      };
      const uniffiHandleSuccess = (returnValue) => {
        uniffiFutureCallback.call(
          uniffiFutureCallback,
          uniffiCallbackData,
          /* UniffiForeignFutureResultRustBuffer */
          {
            return_value: FfiConverterTypeDriverServiceResponse.lower(returnValue, cua_driver_sdk_ffi_default().rustbuffer_alloc),
            call_status: uniffiCaller2.createCallStatus()
          }
        );
      };
      const uniffiHandleError = (code, errorBuf) => {
        uniffiFutureCallback.call(
          uniffiFutureCallback,
          uniffiCallbackData,
          /* UniffiForeignFutureResultRustBuffer */
          {
            return_value: (
              /*empty*/
              new Uint8Array(0)
            ),
            // TODO create callstatus with error.
            call_status: uniffiCaller2.createErrorStatus(code, errorBuf)
          }
        );
      };
      const uniffiForeignFuture = uniffiTraitInterfaceCallAsyncWithError(
        /*makeCall:*/
        uniffiMakeCall,
        /*handleSuccess:*/
        uniffiHandleSuccess,
        /*handleError:*/
        uniffiHandleError,
        /*isErrorType:*/
        DriverServiceTransportError.instanceOf,
        /*lowerError:*/
        FfiConverterTypeDriverServiceTransportError.lower.bind(FfiConverterTypeDriverServiceTransportError),
        /*lowerString:*/
        FfiConverterString2.lower.bind(FfiConverterString2),
        /*alloc:*/
        cua_driver_sdk_ffi_default().rustbuffer_alloc
      );
      return uniffiForeignFuture;
    },
    uniffi_free: (uniffiHandle) => {
      FfiConverterTypeDriverServiceTransport.drop(uniffiHandle);
    },
    uniffi_clone: (uniffiHandle) => {
      return FfiConverterTypeDriverServiceTransport.clone(uniffiHandle);
    }
  },
  register: () => {
    cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_init_callback_vtable_driverservicetransport(uniffiCallbackInterfaceDriverServiceTransport.vtable);
  }
};
var EmbeddedCuaDriverHost = class extends UniffiAbstractObject {
  [uniffiTypeNameSymbol] = "EmbeddedCuaDriverHost";
  [destructorGuardSymbol];
  [pointerLiteralSymbol];
  constructor(binaryPath, hostBundleId) {
    super();
    const pointer = uniffiCaller2.rustCallWithError(
      /*liftError:*/
      FfiConverterTypeEmbeddedDriverError.lift.bind(FfiConverterTypeEmbeddedDriverError),
      /*caller:*/
      (callStatus) => {
        return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_constructor_embeddedcuadriverhost_new(FfiConverterString2.lower(binaryPath, cua_driver_sdk_ffi_default().rustbuffer_alloc), FfiConverterString2.lower(hostBundleId, cua_driver_sdk_ffi_default().rustbuffer_alloc), callStatus);
      },
      /*liftString:*/
      FfiConverterString2.lift.bind(FfiConverterString2)
    );
    this[pointerLiteralSymbol] = pointer;
    this[destructorGuardSymbol] = uniffiTypeEmbeddedCuaDriverHostObjectFactory.bless(pointer);
  }
  static withOptions(options) {
    return FfiConverterTypeEmbeddedCuaDriverHost.lift(uniffiCaller2.rustCallWithError(
      /*liftError:*/
      FfiConverterTypeEmbeddedDriverError.lift.bind(FfiConverterTypeEmbeddedDriverError),
      /*caller:*/
      (callStatus) => {
        return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_constructor_embeddedcuadriverhost_with_options(FfiConverterTypeEmbeddedDriverHostOptions.lower(options, cua_driver_sdk_ffi_default().rustbuffer_alloc), callStatus);
      },
      /*liftString:*/
      FfiConverterString2.lift.bind(FfiConverterString2)
    ));
  }
  connection() {
    return ((__rb) => {
      try {
        return FfiConverterOptionalTypeEmbeddedDriverConnection.lift(__rb);
      } finally {
        cua_driver_sdk_ffi_default().rustbuffer_free(__rb);
      }
    })(uniffiCaller2.rustCall(
      /*caller:*/
      (callStatus) => {
        return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_embeddedcuadriverhost_connection(uniffiTypeEmbeddedCuaDriverHostObjectFactory.clonePointer(this), callStatus);
      },
      /*liftString:*/
      FfiConverterString2.lift.bind(FfiConverterString2)
    ));
  }
  async restart(asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_embeddedcuadriverhost_restart(uniffiTypeEmbeddedCuaDriverHostObjectFactory.clonePointer(this));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeEmbeddedDriverConnection.lift.bind(FfiConverterTypeEmbeddedDriverConnection),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeEmbeddedDriverError.lift.bind(FfiConverterTypeEmbeddedDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  async start(asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_embeddedcuadriverhost_start(uniffiTypeEmbeddedCuaDriverHostObjectFactory.clonePointer(this));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeEmbeddedDriverConnection.lift.bind(FfiConverterTypeEmbeddedDriverConnection),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeEmbeddedDriverError.lift.bind(FfiConverterTypeEmbeddedDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  state() {
    return ((__rb) => {
      try {
        return FfiConverterTypeEmbeddedDriverHostState.lift(__rb);
      } finally {
        cua_driver_sdk_ffi_default().rustbuffer_free(__rb);
      }
    })(uniffiCaller2.rustCall(
      /*caller:*/
      (callStatus) => {
        return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_embeddedcuadriverhost_state(uniffiTypeEmbeddedCuaDriverHostObjectFactory.clonePointer(this), callStatus);
      },
      /*liftString:*/
      FfiConverterString2.lift.bind(FfiConverterString2)
    ));
  }
  async stop(asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_embeddedcuadriverhost_stop(uniffiTypeEmbeddedCuaDriverHostObjectFactory.clonePointer(this));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_void,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_void,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_void,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_void,
        /*liftFunc:*/
        (_v) => {
        },
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeEmbeddedDriverError.lift.bind(FfiConverterTypeEmbeddedDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  async waitForExit(generation, asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_embeddedcuadriverhost_wait_for_exit(uniffiTypeEmbeddedCuaDriverHostObjectFactory.clonePointer(this), FfiConverterString2.lower(generation, cua_driver_sdk_ffi_default().rustbuffer_alloc));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_rust_buffer,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_rust_buffer,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_rust_buffer,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_rust_buffer,
        // Async returns always go through the JS-side converter: the
        // FFI symbol returns the future handle (u64), and the user-level
        // RustBuffer comes back via the shared `rust_future_complete_*`
        // export. The bytes the runtime hands back must be deserialized
        // here using the per-callable return-type converter.
        /*liftFunc:*/
        FfiConverterTypeEmbeddedDriverExit.lift.bind(FfiConverterTypeEmbeddedDriverExit),
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeEmbeddedDriverError.lift.bind(FfiConverterTypeEmbeddedDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  uniffiDestroy() {
    const ptr = this[destructorGuardSymbol];
    if (ptr !== void 0) {
      const pointer = uniffiTypeEmbeddedCuaDriverHostObjectFactory.pointer(this);
      uniffiTypeEmbeddedCuaDriverHostObjectFactory.freePointer(pointer);
      uniffiTypeEmbeddedCuaDriverHostObjectFactory.unbless(ptr);
      delete this[destructorGuardSymbol];
    }
  }
  static instanceOf(obj_) {
    return uniffiTypeEmbeddedCuaDriverHostObjectFactory.isConcreteType(obj_);
  }
};
var uniffiTypeEmbeddedCuaDriverHostObjectFactory = (() => {
  const registry = typeof FinalizationRegistry !== "undefined" ? new FinalizationRegistry((heldValue) => {
    uniffiTypeEmbeddedCuaDriverHostObjectFactory.freePointer(heldValue);
  }) : null;
  return {
    create(pointer) {
      const instance = Object.create(EmbeddedCuaDriverHost.prototype);
      instance[pointerLiteralSymbol] = pointer;
      instance[destructorGuardSymbol] = this.bless(pointer);
      instance[uniffiTypeNameSymbol] = "EmbeddedCuaDriverHost";
      return instance;
    },
    bless(p) {
      const ptr = {
        p,
        // make sure this object doesn't get optimized away.
        markDestroyed: () => void 0
      };
      if (registry) {
        registry.register(ptr, p, ptr);
      }
      return ptr;
    },
    unbless(ptr_) {
      if (registry) {
        registry.unregister(ptr_);
      }
    },
    pointer(obj_) {
      if (obj_[destructorGuardSymbol] === void 0) {
        throw new UniffiInternalError.UnexpectedNullPointer();
      }
      return obj_[pointerLiteralSymbol];
    },
    clonePointer(obj_) {
      const pointer = this.pointer(obj_);
      return uniffiCaller2.rustCall(
        /*caller:*/
        (callStatus) => cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_clone_embeddedcuadriverhost(pointer, callStatus),
        /*liftString:*/
        FfiConverterString2.lift
      );
    },
    freePointer(pointer) {
      uniffiCaller2.rustCall(
        /*caller:*/
        (callStatus) => cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_free_embeddedcuadriverhost(pointer, callStatus),
        /*liftString:*/
        FfiConverterString2.lift
      );
    },
    isConcreteType(obj_) {
      return obj_[destructorGuardSymbol] && obj_[uniffiTypeNameSymbol] === "EmbeddedCuaDriverHost";
    }
  };
})();
var FfiConverterTypeEmbeddedCuaDriverHost = new FfiConverterObject(uniffiTypeEmbeddedCuaDriverHostObjectFactory);
var McpDriverChannel = class extends UniffiAbstractObject {
  [uniffiTypeNameSymbol] = "McpDriverChannel";
  [destructorGuardSymbol];
  [pointerLiteralSymbol];
  // No primary constructor declared for this class.
  constructor(pointer) {
    super();
    this[pointerLiteralSymbol] = pointer;
    this[destructorGuardSymbol] = uniffiTypeMcpDriverChannelObjectFactory.bless(pointer);
  }
  async close(asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_mcpdriverchannel_close(uniffiTypeMcpDriverChannelObjectFactory.clonePointer(this));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_void,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_void,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_void,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_void,
        /*liftFunc:*/
        (_v) => {
        },
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  driver() {
    return FfiConverterTypeCuaDriver.lift(uniffiCaller2.rustCallWithError(
      /*liftError:*/
      FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError),
      /*caller:*/
      (callStatus) => {
        return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_mcpdriverchannel_driver(uniffiTypeMcpDriverChannelObjectFactory.clonePointer(this), callStatus);
      },
      /*liftString:*/
      FfiConverterString2.lift.bind(FfiConverterString2)
    ));
  }
  async open(asyncOpts_) {
    const __stack = uniffiIsDebug2 ? new Error().stack : void 0;
    try {
      return await uniffiRustCallAsync(
        /*rustCaller:*/
        uniffiCaller2,
        /*rustFutureFunc:*/
        () => {
          return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_mcpdriverchannel_open(uniffiTypeMcpDriverChannelObjectFactory.clonePointer(this));
        },
        /*pollFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_poll_void,
        /*cancelFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_cancel_void,
        /*completeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_complete_void,
        /*freeFunc:*/
        cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_rust_future_free_void,
        /*liftFunc:*/
        (_v) => {
        },
        /*liftString:*/
        FfiConverterString2.lift.bind(FfiConverterString2),
        /*asyncOpts:*/
        asyncOpts_,
        /*errorHandler:*/
        FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError)
      );
    } catch (__error) {
      if (uniffiIsDebug2 && __error instanceof Error) {
        __error.stack = __stack;
      }
      throw __error;
    }
  }
  publicSession() {
    return ((__rb) => {
      try {
        return FfiConverterString2.lift(__rb);
      } finally {
        cua_driver_sdk_ffi_default().rustbuffer_free(__rb);
      }
    })(uniffiCaller2.rustCallWithError(
      /*liftError:*/
      FfiConverterTypeDriverError.lift.bind(FfiConverterTypeDriverError),
      /*caller:*/
      (callStatus) => {
        return cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_method_mcpdriverchannel_public_session(uniffiTypeMcpDriverChannelObjectFactory.clonePointer(this), callStatus);
      },
      /*liftString:*/
      FfiConverterString2.lift.bind(FfiConverterString2)
    ));
  }
  uniffiDestroy() {
    const ptr = this[destructorGuardSymbol];
    if (ptr !== void 0) {
      const pointer = uniffiTypeMcpDriverChannelObjectFactory.pointer(this);
      uniffiTypeMcpDriverChannelObjectFactory.freePointer(pointer);
      uniffiTypeMcpDriverChannelObjectFactory.unbless(ptr);
      delete this[destructorGuardSymbol];
    }
  }
  static instanceOf(obj_) {
    return uniffiTypeMcpDriverChannelObjectFactory.isConcreteType(obj_);
  }
};
var uniffiTypeMcpDriverChannelObjectFactory = (() => {
  const registry = typeof FinalizationRegistry !== "undefined" ? new FinalizationRegistry((heldValue) => {
    uniffiTypeMcpDriverChannelObjectFactory.freePointer(heldValue);
  }) : null;
  return {
    create(pointer) {
      const instance = Object.create(McpDriverChannel.prototype);
      instance[pointerLiteralSymbol] = pointer;
      instance[destructorGuardSymbol] = this.bless(pointer);
      instance[uniffiTypeNameSymbol] = "McpDriverChannel";
      return instance;
    },
    bless(p) {
      const ptr = {
        p,
        // make sure this object doesn't get optimized away.
        markDestroyed: () => void 0
      };
      if (registry) {
        registry.register(ptr, p, ptr);
      }
      return ptr;
    },
    unbless(ptr_) {
      if (registry) {
        registry.unregister(ptr_);
      }
    },
    pointer(obj_) {
      if (obj_[destructorGuardSymbol] === void 0) {
        throw new UniffiInternalError.UnexpectedNullPointer();
      }
      return obj_[pointerLiteralSymbol];
    },
    clonePointer(obj_) {
      const pointer = this.pointer(obj_);
      return uniffiCaller2.rustCall(
        /*caller:*/
        (callStatus) => cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_clone_mcpdriverchannel(pointer, callStatus),
        /*liftString:*/
        FfiConverterString2.lift
      );
    },
    freePointer(pointer) {
      uniffiCaller2.rustCall(
        /*caller:*/
        (callStatus) => cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_fn_free_mcpdriverchannel(pointer, callStatus),
        /*liftString:*/
        FfiConverterString2.lift
      );
    },
    isConcreteType(obj_) {
      return obj_[destructorGuardSymbol] && obj_[uniffiTypeNameSymbol] === "McpDriverChannel";
    }
  };
})();
var FfiConverterTypeMcpDriverChannel = new FfiConverterObject(uniffiTypeMcpDriverChannelObjectFactory);
var FfiConverterSequenceTypeSessionPermissionMode = new FfiConverterArray(FfiConverterTypeSessionPermissionMode);
var FfiConverterOptionalString2 = new FfiConverterOptional(FfiConverterString2);
var FfiConverterSequenceString2 = new FfiConverterArray(FfiConverterString2);
var FfiConverterSequenceTypeDriverServiceHeader = new FfiConverterArray(FfiConverterTypeDriverServiceHeader);
var FfiConverterSequenceTypeEmbeddedEnvironmentVariable = new FfiConverterArray(FfiConverterTypeEmbeddedEnvironmentVariable);
var FfiConverterOptionalInt322 = new FfiConverterOptional(FfiConverterInt32);
var FfiConverterOptionalUInt642 = new FfiConverterOptional(FfiConverterUInt64);
var FfiConverterOptionalTypeEmbeddedPermissionMode = new FfiConverterOptional(FfiConverterTypeEmbeddedPermissionMode);
var FfiConverterSequenceTypeImageContent = new FfiConverterArray(FfiConverterTypeImageContent);
var FfiConverterOptionalTypeActionResult = new FfiConverterOptional(FfiConverterTypeActionResult2);
var FfiConverterOptionalTypeVerifyStateOutput = new FfiConverterOptional(FfiConverterTypeVerifyStateOutput2);
var FfiConverterOptionalTypeEmbeddedDriverConnection = new FfiConverterOptional(FfiConverterTypeEmbeddedDriverConnection);
var FfiConverterOptionalTypeDriverOptions = new FfiConverterOptional(FfiConverterTypeDriverOptions);
function uniffiEnsureInitialized2() {
  const bindingsContractVersion = 30;
  const scaffoldingContractVersion = cua_driver_sdk_ffi_default().ffi_cua_driver_sdk_uniffi_contract_version();
  if (bindingsContractVersion !== scaffoldingContractVersion) {
    throw new UniffiInternalError.ContractVersionMismatch(scaffoldingContractVersion, bindingsContractVersion);
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_func_connect_remote_channel() !== 54784) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_func_connect_remote_channel");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_func_create_remote_trusted_session() !== 53066) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_func_create_remote_trusted_session");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_func_create_trusted_session() !== 50573) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_func_create_trusted_session");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_func_current_mac_os_permission_status() !== 22890) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_func_current_mac_os_permission_status");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_func_open_mac_os_screen_recording_settings() !== 6663) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_func_open_mac_os_screen_recording_settings");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_func_open_mcp_driver_channel() !== 952) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_func_open_mcp_driver_channel");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_func_request_mac_os_permissions() !== 61823) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_func_request_mac_os_permissions");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_constructor_cuadriver_connect() !== 60859) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_constructor_cuadriver_connect");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_constructor_cuadriver_connect_with_client_kind() !== 43287) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_constructor_cuadriver_connect_with_client_kind");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_constructor_cuadriver_create() !== 15191) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_constructor_cuadriver_create");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_constructor_cuadriver_create_configured() !== 58596) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_constructor_cuadriver_create_configured");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_constructor_cuadriver_create_configured_with_activity_observer() !== 37471) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_constructor_cuadriver_create_configured_with_activity_observer");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_constructor_cuadriver_create_configured_with_activity_observer_and_client_kind() !== 50814) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_constructor_cuadriver_create_configured_with_activity_observer_and_client_kind");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_constructor_cuadriver_create_configured_with_authorization_host() !== 28087) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_constructor_cuadriver_create_configured_with_authorization_host");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_constructor_cuadriver_create_configured_with_authorization_host_and_client_kind() !== 17837) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_constructor_cuadriver_create_configured_with_authorization_host_and_client_kind");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_constructor_cuadriver_create_configured_with_client_kind() !== 23819) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_constructor_cuadriver_create_configured_with_client_kind");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_constructor_cuadriver_create_configured_with_host_integrations() !== 2578) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_constructor_cuadriver_create_configured_with_host_integrations");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_constructor_cuadriver_create_configured_with_host_integrations_and_client_kind() !== 25294) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_constructor_cuadriver_create_configured_with_host_integrations_and_client_kind");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_constructor_cuadriver_create_private_worker() !== 8571) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_constructor_cuadriver_create_private_worker");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_constructor_cuadriver_create_private_worker_with_client_kind() !== 31571) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_constructor_cuadriver_create_private_worker_with_client_kind");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_constructor_cuadriver_create_with_client_kind() !== 3630) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_constructor_cuadriver_create_with_client_kind");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriver_call_tool() !== 24493) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriver_call_tool");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriver_click() !== 22807) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriver_click");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriver_clipboard_read() !== 58238) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriver_clipboard_read");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriver_clipboard_write() !== 8399) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriver_clipboard_write");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriver_drag() !== 25742) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriver_drag");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriver_end_session() !== 18486) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriver_end_session");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriver_escalate_session() !== 6924) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriver_escalate_session");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriver_execution_mode() !== 2639) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriver_execution_mode");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriver_get_agent_cursor_state() !== 45642) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriver_get_agent_cursor_state");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriver_get_cursor_position() !== 34285) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriver_get_cursor_position");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriver_get_desktop_state() !== 65084) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriver_get_desktop_state");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriver_get_screen_size() !== 55616) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriver_get_screen_size");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriver_get_session() !== 17834) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriver_get_session");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriver_get_session_state() !== 49966) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriver_get_session_state");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriver_get_window_state() !== 62142) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriver_get_window_state");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriver_hotkey() !== 53333) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriver_hotkey");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriver_invoke_menu() !== 13118) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriver_invoke_menu");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriver_is_available() !== 42961) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriver_is_available");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriver_list_apps() !== 35505) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriver_list_apps");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriver_list_host_sessions_json() !== 13193) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriver_list_host_sessions_json");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriver_list_sessions() !== 40131) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriver_list_sessions");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriver_list_tools_json() !== 33039) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriver_list_tools_json");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriver_list_windows() !== 52601) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriver_list_windows");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriver_metadata() !== 55026) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriver_metadata");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriver_move_cursor() !== 18320) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriver_move_cursor");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriver_press_key() !== 63712) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriver_press_key");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriver_runtime_scope_prefix() !== 2453) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriver_runtime_scope_prefix");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriver_scroll() !== 52290) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriver_scroll");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriver_set_agent_cursor_enabled() !== 26268) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriver_set_agent_cursor_enabled");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriver_set_agent_cursor_motion() !== 12578) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriver_set_agent_cursor_motion");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriver_set_agent_cursor_theme() !== 53908) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriver_set_agent_cursor_theme");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriver_set_window_frame() !== 6509) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriver_set_window_frame");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriver_shutdown() !== 36331) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriver_shutdown");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriver_socket_path() !== 48126) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriver_socket_path");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriver_start_session() !== 45055) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriver_start_session");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriver_type_text() !== 25156) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriver_type_text");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriver_verify_state() !== 26193) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriver_verify_state");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriversession_call_tool() !== 52859) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriversession_call_tool");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriversession_click() !== 50816) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriversession_click");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriversession_clipboard_read() !== 23560) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriversession_clipboard_read");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriversession_clipboard_write() !== 45732) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriversession_clipboard_write");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriversession_close() !== 58108) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriversession_close");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriversession_drag() !== 5854) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriversession_drag");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriversession_end_session() !== 42785) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriversession_end_session");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriversession_escalate_session() !== 34392) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriversession_escalate_session");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriversession_get_agent_cursor_state() !== 60344) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriversession_get_agent_cursor_state");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriversession_get_cursor_position() !== 54838) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriversession_get_cursor_position");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriversession_get_desktop_state() !== 26695) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriversession_get_desktop_state");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriversession_get_screen_size() !== 9763) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriversession_get_screen_size");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriversession_get_session() !== 54666) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriversession_get_session");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriversession_get_session_state() !== 55370) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriversession_get_session_state");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriversession_get_window_state() !== 21266) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriversession_get_window_state");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriversession_hotkey() !== 12820) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriversession_hotkey");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriversession_invoke_menu() !== 2742) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriversession_invoke_menu");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriversession_list_apps() !== 51520) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriversession_list_apps");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriversession_list_sessions() !== 32840) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriversession_list_sessions");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriversession_list_windows() !== 20571) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriversession_list_windows");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriversession_move_cursor() !== 35768) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriversession_move_cursor");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriversession_press_key() !== 36768) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriversession_press_key");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriversession_scroll() !== 8013) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriversession_scroll");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriversession_set_agent_cursor_enabled() !== 37153) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriversession_set_agent_cursor_enabled");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriversession_set_agent_cursor_motion() !== 26144) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriversession_set_agent_cursor_motion");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriversession_set_agent_cursor_theme() !== 29734) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriversession_set_agent_cursor_theme");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriversession_set_window_frame() !== 65413) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriversession_set_window_frame");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriversession_start_session() !== 13118) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriversession_start_session");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriversession_type_text() !== 63241) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriversession_type_text");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_cuadriversession_verify_state() !== 36472) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_cuadriversession_verify_state");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_driveractivityobserver_on_activity() !== 9786) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_driveractivityobserver_on_activity");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_driverauthorizationhost_authorize() !== 10089) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_driverauthorizationhost_authorize");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_driverservicetransport_send() !== 53285) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_driverservicetransport_send");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_constructor_embeddedcuadriverhost_new() !== 10108) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_constructor_embeddedcuadriverhost_new");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_constructor_embeddedcuadriverhost_with_options() !== 41121) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_constructor_embeddedcuadriverhost_with_options");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_embeddedcuadriverhost_connection() !== 44467) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_embeddedcuadriverhost_connection");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_embeddedcuadriverhost_restart() !== 27248) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_embeddedcuadriverhost_restart");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_embeddedcuadriverhost_start() !== 16011) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_embeddedcuadriverhost_start");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_embeddedcuadriverhost_state() !== 42795) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_embeddedcuadriverhost_state");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_embeddedcuadriverhost_stop() !== 28521) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_embeddedcuadriverhost_stop");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_embeddedcuadriverhost_wait_for_exit() !== 21124) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_embeddedcuadriverhost_wait_for_exit");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_foreigndriverenvelopechannel_identity() !== 13418) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_foreigndriverenvelopechannel_identity");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_foreigndriverenvelopechannel_negotiate() !== 29939) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_foreigndriverenvelopechannel_negotiate");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_foreigndriverenvelopechannel_exchange() !== 707) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_foreigndriverenvelopechannel_exchange");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_foreigndriverenvelopechannel_bind_session() !== 6555) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_foreigndriverenvelopechannel_bind_session");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_foreigndriverenvelopechannel_cancel() !== 60148) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_foreigndriverenvelopechannel_cancel");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_foreigndriverenvelopechannel_close() !== 42601) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_foreigndriverenvelopechannel_close");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_mcpdriverchannel_close() !== 59055) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_mcpdriverchannel_close");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_mcpdriverchannel_driver() !== 6660) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_mcpdriverchannel_driver");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_mcpdriverchannel_open() !== 13274) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_mcpdriverchannel_open");
  }
  if (cua_driver_sdk_ffi_default().uniffi_cua_driver_sdk_checksum_method_mcpdriverchannel_public_session() !== 15027) {
    throw new UniffiInternalError.ApiChecksumMismatch("uniffi_cua_driver_sdk_checksum_method_mcpdriverchannel_public_session");
  }
  uniffiCallbackInterfaceForeignDriverEnvelopeChannel.register();
  uniffiCallbackInterfaceDriverActivityObserver.register();
  uniffiCallbackInterfaceDriverAuthorizationHost.register();
  uniffiCallbackInterfaceDriverServiceTransport.register();
}
var cua_driver_sdk_default = Object.freeze({
  initialize: uniffiEnsureInitialized2,
  converters: {
    FfiConverterTypeActionCompletion,
    FfiConverterTypeConfiguredDriverOptions,
    FfiConverterTypeCuaDriver,
    FfiConverterTypeCuaDriverSession,
    FfiConverterTypeDriverActivityEvent,
    FfiConverterTypeDriverActivityKind,
    FfiConverterTypeDriverActivityObserver,
    FfiConverterTypeDriverAuthorizationAction,
    FfiConverterTypeDriverAuthorizationDecision,
    FfiConverterTypeDriverAuthorizationHost,
    FfiConverterTypeDriverAuthorizationHostError,
    FfiConverterTypeDriverAuthorizationRequest,
    FfiConverterTypeDriverError,
    FfiConverterTypeDriverExecutionMode,
    FfiConverterTypeDriverMetadata,
    FfiConverterTypeDriverOptions,
    FfiConverterTypeDriverServiceHeader,
    FfiConverterTypeDriverServiceRequest,
    FfiConverterTypeDriverServiceResponse,
    FfiConverterTypeDriverServiceTransport,
    FfiConverterTypeDriverServiceTransportError,
    FfiConverterTypeEmbeddedCuaDriverHost,
    FfiConverterTypeEmbeddedDriverConnection,
    FfiConverterTypeEmbeddedDriverError,
    FfiConverterTypeEmbeddedDriverExit,
    FfiConverterTypeEmbeddedDriverHostOptions,
    FfiConverterTypeEmbeddedDriverHostState,
    FfiConverterTypeEmbeddedEnvironmentVariable,
    FfiConverterTypeEmbeddedMcpConfiguration,
    FfiConverterTypeEmbeddedPermissionMode,
    FfiConverterTypeForeignDriverBoundChannel,
    FfiConverterTypeForeignDriverChannelCapabilities,
    FfiConverterTypeForeignDriverChannelError,
    FfiConverterTypeForeignDriverChannelIdentity,
    FfiConverterTypeForeignDriverEnvelopeChannel,
    FfiConverterTypeForeignDriverRequestEnvelope,
    FfiConverterTypeForeignDriverResponseEnvelope,
    FfiConverterTypeImageContent,
    FfiConverterTypeMacOsPermissionStatus,
    FfiConverterTypeMcpDriverChannel,
    FfiConverterTypePrivateWorkerOptions,
    FfiConverterTypeRuntimeAuthorizationOptions,
    FfiConverterTypeSdkClientKind,
    FfiConverterTypeSessionPermissionMode,
    FfiConverterTypeToolResult,
    FfiConverterTypeTrustedSessionOptions
  }
});
export {
  EmbeddedCuaDriverHost
};
