# Bun HTMLRewriter

> Use Bun's HTMLRewriter to transform HTML documents with CSS selectors

HTMLRewriter lets you use CSS selectors to transform HTML documents. It works with `Request`, `Response`, as well as `string`. Bun's implementation is based on Cloudflare's [lol-html](https://github.com/cloudflare/lol-html).

## Usage

```ts
const rewriter = new HTMLRewriter().on("img", {
  element(img) {
    img.setAttribute("src", "https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg");
    img.before('<a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ" target="_blank">', { html: true });
    img.after("</a>", { html: true });
    img.setAttribute("alt", "Definitely not a rickroll");
  },
});

const html = `
<html>
<body>
  <img src="/cat.jpg">
  <img src="dog.png">
  <img src="https://example.com/bird.webp">
</body>
</html>
`;

const result = rewriter.transform(html);
console.log(result);
```

### Input types

HTMLRewriter can transform HTML from various sources:

```ts
rewriter.transform(new Response("<div>content</div>"));  // From Response
rewriter.transform("<div>content</div>");                 // From string
rewriter.transform(new TextEncoder().encode("<div>content</div>").buffer); // From ArrayBuffer
rewriter.transform(new Blob(["<div>content</div>"]));     // From Blob
rewriter.transform(Bun.file("index.html"));               // From File
```

> Note: Cloudflare Workers implementation of HTMLRewriter only supports `Response` objects.

### Element Handlers

```ts
rewriter.on("div.content", {
  element(element) {
    element.setAttribute("class", "new-content");
    element.append("<p>New content</p>", { html: true });
  },
  text(text) {
    text.replace("new text");
  },
  comments(comment) {
    comment.remove();
  },
});
```

Handlers can be asynchronous and return a Promise. Async operations will block the transformation until they complete:

```ts
rewriter.on("div", {
  async element(element) {
    await Bun.sleep(1000);
    element.setInnerContent("<span>replace</span>", { html: true });
  },
});
```

### CSS Selector Support

```ts
// Tag selectors
rewriter.on("p", handler);

// Class selectors
rewriter.on("p.red", handler);

// ID selectors
rewriter.on("h1#header", handler);

// Attribute selectors
rewriter.on("p[data-test]", handler);          // Has attribute
rewriter.on('p[data-test="one"]', handler);     // Exact match
rewriter.on('p[data-test="one" i]', handler);   // Case-insensitive
rewriter.on('p[data-test="one" s]', handler);   // Case-sensitive
rewriter.on('p[data-test~="two"]', handler);    // Word match
rewriter.on('p[data-test^="a"]', handler);      // Starts with
rewriter.on('p[data-test$="1"]', handler);      // Ends with
rewriter.on('p[data-test*="b"]', handler);      // Contains
rewriter.on('p[data-test|="a"]', handler);      // Dash-separated

// Combinators
rewriter.on("div span", handler);   // Descendant
rewriter.on("div > span", handler); // Direct child

// Pseudo-classes
rewriter.on("p:nth-child(2)", handler);
rewriter.on("p:first-child", handler);
rewriter.on("p:nth-of-type(2)", handler);
rewriter.on("p:first-of-type", handler);
rewriter.on("p:not(:first-child)", handler);

// Universal selector
rewriter.on("*", handler);
```

### Element Operations

```ts
rewriter.on("div", {
  element(el) {
    // Attributes
    el.setAttribute("class", "new-class").setAttribute("data-id", "123");
    const classAttr = el.getAttribute("class");
    const hasId = el.hasAttribute("id");
    el.removeAttribute("class");

    // Content manipulation
    el.setInnerContent("New content");                              // Escapes HTML by default
    el.setInnerContent("<p>HTML content</p>", { html: true });     // Parses HTML
    el.setInnerContent("");                                         // Clear content

    // Position manipulation
    el.before("Content before").after("Content after").prepend("First child").append("Last child");

    // HTML content insertion
    el.before("<span>before</span>", { html: true })
      .after("<span>after</span>", { html: true })
      .prepend("<span>first</span>", { html: true })
      .append("<span>last</span>", { html: true });

    // Removal
    el.remove();                // Remove element and contents
    el.removeAndKeepContent();  // Remove only the element tags

    // Properties
    console.log(el.tagName);        // Lowercase tag name
    console.log(el.namespaceURI);   // Element's namespace URI
    console.log(el.selfClosing);    // Whether element is self-closing
    console.log(el.canHaveContent); // Whether element can contain content
    console.log(el.removed);        // Whether element was removed

    // Attributes iteration
    for (const [name, value] of el.attributes) {
      console.log(name, value);
    }

    // End tag handling
    el.onEndTag(endTag => {
      endTag.before("Before end tag");
      endTag.after("After end tag");
      endTag.remove();
      console.log(endTag.name);
    });
  },
});
```

### Text Operations

```ts
rewriter.on("p", {
  text(text) {
    console.log(text.text);               // Text content
    console.log(text.lastInTextNode);     // Whether this is the last chunk
    console.log(text.removed);            // Whether text was removed

    text.before("Before text").after("After text").replace("New text").remove();

    text.before("<span>before</span>", { html: true })
      .after("<span>after</span>", { html: true })
      .replace("<span>replace</span>", { html: true });
  },
});
```

### Comment Operations

```ts
rewriter.on("*", {
  comments(comment) {
    console.log(comment.text);
    comment.text = "New comment text";
    console.log(comment.removed);

    comment.before("Before comment").after("After comment").replace("New comment").remove();

    comment.before("<span>before</span>", { html: true })
      .after("<span>after</span>", { html: true })
      .replace("<span>replace</span>", { html: true });
  },
});
```

### Document Handlers

```ts
rewriter.onDocument({
  doctype(doctype) {
    console.log(doctype.name);       // "html"
    console.log(doctype.publicId);   // public identifier if present
    console.log(doctype.systemId);   // system identifier if present
  },
  text(text) {
    console.log(text.text);
  },
  comments(comment) {
    console.log(comment.text);
  },
  end(end) {
    end.append("<!-- Footer -->", { html: true });
  },
});
```

### Response Handling

When transforming a Response:
- The status code, headers, and other response properties are preserved
- The body is transformed while maintaining streaming capabilities
- Content-encoding (like gzip) is handled automatically
- The original response body is marked as used after transformation
- Headers are cloned to the new response

## Error Handling

HTMLRewriter operations can throw errors in several cases:
- Invalid selector syntax in `on()` method
- Invalid HTML content in transformation methods
- Stream errors when processing Response bodies
- Memory allocation failures
- Invalid input types (e.g., passing Symbol)
- Body already used errors

```ts
try {
  const result = rewriter.transform(input);
} catch (error) {
  console.error("HTMLRewriter error:", error);
}
```

## See also

You can also read the [Cloudflare documentation](https://developers.cloudflare.com/workers/runtime-apis/html-rewriter/), which this API is intended to be compatible with.
