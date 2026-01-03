declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}

declare module '*.module.scss' {
  const classes: { [key: string]: string };
  export default classes;
}

declare module '*.scss';
declare module '*.css';


declare interface NodeModule {
  hot?: { accept: (path: string, callback: () => void) => void };
}

declare module '*.png';
declare module '*.jpeg';
declare module '*.jpg';
declare module '*.mp3';
declare module '*.obj';

declare module '*.svg' {
  /**
   * The URL to the SVG file.
   */

  const content: string;
  export default content;
}
// .env variables

declare namespace NodeJS {
  interface ProcessEnv {
    
  }
}

