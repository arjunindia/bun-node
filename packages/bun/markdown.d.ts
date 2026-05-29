export const markdown: {
  html(md: string, options?: Record<string, any>): string;
  ansi(md: string, options?: Record<string, any>): string;
  render(md: string, callbacks?: Record<string, Function>, options?: Record<string, any>): string;
  react(md: string, components?: Record<string, any>, options?: Record<string, any>): any;
};
