import { marked } from "marked";

const markdown = {
  html(md, options = {}) {
    const ext = [];
    if (options.tables !== false) ext.push(marked.tables);
    if (options.strikethrough !== false) ext.push(marked.strikethrough);
    if (options.tasklists) ext.push(marked.tasklists);

    const renderer = new marked.Renderer();

    if (options.headings) {
      const headingIds = options.headings === true || options.headings.ids;
      renderer.heading = function ({ tokens, depth }) {
        const text = this.parser.parseInline(tokens);
        const id = headingIds ? text.toLowerCase().replace(/[^\w]+/g, "-") : undefined;
        const idAttr = id ? ` id="${id}"` : "";
        const anchor = headingIds ? `<a href="#${id}">${text}</a>` : text;
        return `<h${depth}${idAttr}>${anchor}</h${depth}>\n`;
      };
    }

    marked.use({
      renderer,
      gfm: true,
      breaks: options.hardSoftBreaks ?? false,
    });

    return marked.parse(md);
  },

  ansi(md, options = {}) {
    const html = this.html(md, options);
    return html
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, "\x1b[1;4m$1\x1b[0m\n")
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, "\x1b[1;4m$1\x1b[0m\n")
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, "\x1b[1m$1\x1b[0m\n")
      .replace(/<strong>(.*?)<\/strong>/gi, "\x1b[1m$1\x1b[22m")
      .replace(/<em>(.*?)<\/em>/gi, "\x1b[3m$1\x1b[23m")
      .replace(/<code>(.*?)<\/code>/gi, "\x1b[7m$1\x1b[27m")
      .replace(/<a href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "\x1b[4m$2\x1b[24m ($1)")
      .replace(/<li>(.*?)<\/li>/gi, "  * $1\n")
      .replace(/<hr\s*\/?>/gi, "-".repeat(80) + "\n")
      .replace(/<blockquote>(.*?)<\/blockquote>/gi, "  | $1\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/\n{3,}/g, "\n\n");
  },

  render(md, callbacks = {}, options = {}) {
    const html = this.html(md, options);
    let result = html;
    for (const [tag, fn] of Object.entries(callbacks)) {
      const tagMap = {
        heading: /<h(\d)([^>]*)>([\s\S]*?)<\/h\d>/g,
        paragraph: /<p>([\s\S]*?)<\/p>/g,
        strong: /<strong>([\s\S]*?)<\/strong>/g,
        emphasis: /<em>([\s\S]*?)<\/em>/g,
        code: /<code>([\s\S]*?)<\/code>/g,
        link: /<a href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g,
        image: /<img src="([^"]*)"[^>]* alt="([^"]*)"[^>]*>/g,
        hr: /<hr\s*\/?>/g,
        blockquote: /<blockquote>([\s\S]*?)<\/blockquote>/g,
        strikethrough: /<del>([\s\S]*?)<\/del>/g,
      };
      const regex = tagMap[tag];
      if (regex) {
        result = result.replace(regex, (...args) => {
          if (tag === "heading") return fn(args[3], { level: parseInt(args[1]) });
          if (tag === "link") return fn(args[2], { href: args[1] });
          if (tag === "image") return fn("", { src: args[1], title: args[2] });
          if (tag === "hr") return fn("");
          return fn(args[1]);
        });
      }
    }
    return result;
  },

  react(md, components = {}, options = {}) {
    // Simplified React rendering - returns a plain object tree
    const html = this.html(md, options);
    return { $$typeof: Symbol.for("react.element"), type: "div", props: { children: html } };
  },
};

export { markdown };
export default markdown;
