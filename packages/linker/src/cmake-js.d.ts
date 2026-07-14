declare module 'cmake-js' {
  interface CMakeOptions {
    directory?: string;
    out?: string;
    config?: string;
    debug?: boolean;
    silent?: boolean;
    cmakePath?: string;
    cMakeOptions?: Record<string, string>;
    extraCMakeArgs?: string[];
    target?: string;
    parallel?: string;
  }

  export class CMake {
    constructor(options?: CMakeOptions);
    configure(): Promise<void>;
    build(): Promise<void>;
    clean(): Promise<void>;
    rebuild(): Promise<void>;
    compile(): Promise<void>;
  }
}
