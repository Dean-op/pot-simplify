import React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './style.css';

function httpUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : undefined;
    } catch {
        return undefined;
    }
}

export default function MarkdownText({ text, showSource = false, onOpenLink }) {
    if (showSource) {
        return <pre className='translation-source'>{text}</pre>;
    }

    return (
        <div className='translation-markdown'>
            <Markdown
                remarkPlugins={[remarkGfm]}
                skipHtml
                urlTransform={httpUrl}
                components={{
                    a: ({ href, children }) =>
                        href ? (
                            <a
                                href={href}
                                onClick={(event) => {
                                    event.preventDefault();
                                    onOpenLink?.(href);
                                }}
                            >
                                {children}
                            </a>
                        ) : (
                            <span>{children}</span>
                        ),
                    // Translation previews must not make unsolicited image requests.
                    img: ({ alt }) => <span>{alt}</span>,
                    table: ({ children }) => (
                        <div className='translation-table'>
                            <table>{children}</table>
                        </div>
                    ),
                }}
            >
                {text}
            </Markdown>
        </div>
    );
}
