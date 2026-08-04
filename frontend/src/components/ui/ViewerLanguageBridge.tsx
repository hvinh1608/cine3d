'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useLanguage } from '../../lib/i18n';
import { viewerEnglish, viewerEnglishFragments, viewerEnglishPatterns } from '../../lib/viewer-translations';

const TRANSLATED_ATTRIBUTES = ['aria-label', 'title', 'placeholder'] as const;

function translateValue(value: string) {
  const whitespace = value.match(/^\s*/)?.[0] ?? '';
  const trailing = value.match(/\s*$/)?.[0] ?? '';
  const normalized = value.trim();
  if (!normalized) return value;
  const exact = viewerEnglish[normalized];
  if (exact) return `${whitespace}${exact}${trailing}`;
  for (const [pattern, replacement] of viewerEnglishPatterns) {
    if (pattern.test(normalized)) return `${whitespace}${normalized.replace(pattern, replacement)}${trailing}`;
  }
  if (normalized.length <= 140 && /[À-ỹĐđ]/u.test(normalized)) {
    let translated = normalized;
    for (const [source, replacement] of viewerEnglishFragments) {
      translated = translated.replaceAll(source, replacement).replaceAll(source[0].toUpperCase() + source.slice(1), replacement[0].toUpperCase() + replacement.slice(1));
    }
    if (translated !== normalized) return `${whitespace}${translated}${trailing}`;
  }
  return value;
}

export default function ViewerLanguageBridge() {
  const { locale } = useLanguage();
  const pathname = usePathname();
  const originalText = useRef(new WeakMap<Text, string>());
  const originalAttributes = useRef(new WeakMap<Element, Map<string, string>>());

  useEffect(() => {
    if (pathname?.startsWith('/admin')) return;
    const translateTree = (root: Node) => {
      const nodes: Node[] = [root];
      while (nodes.length) {
        const node = nodes.pop()!;
        if (node.nodeType === Node.TEXT_NODE) {
          const textNode = node as Text;
          const parent = textNode.parentElement;
          if (!parent || parent.closest('[data-no-ui-translate], script, style, textarea')) continue;
          if (!originalText.current.has(textNode)) originalText.current.set(textNode, textNode.data);
          const original = originalText.current.get(textNode)!;
          const next = locale === 'en' ? translateValue(original) : original;
          if (textNode.data !== next) textNode.data = next;
          continue;
        }
        if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_NODE) continue;
        if (node instanceof Element) {
          if (node.matches('[data-no-ui-translate], script, style, textarea')) continue;
          let saved = originalAttributes.current.get(node);
          if (!saved) {
            saved = new Map();
            originalAttributes.current.set(node, saved);
          }
          for (const attribute of TRANSLATED_ATTRIBUTES) {
            const current = node.getAttribute(attribute);
            if (current === null) continue;
            if (!saved.has(attribute)) saved.set(attribute, current);
            const original = saved.get(attribute)!;
            const next = locale === 'en' ? translateValue(original) : original;
            if (current !== next) node.setAttribute(attribute, next);
          }
        }
        for (let child = node.lastChild; child; child = child.previousSibling) nodes.push(child);
      }
    };

    translateTree(document.body);
    const observer = new MutationObserver((mutations) => {
      observer.disconnect();
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') translateTree(mutation.target);
        for (const node of mutation.addedNodes) translateTree(node);
      }
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [locale, pathname]);

  return null;
}
