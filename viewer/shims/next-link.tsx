// next/link 대체 — 뷰어에서는 해시 링크(<a href="#/경로">)로 렌더
import type { AnchorHTMLAttributes, ReactNode } from 'react';

interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string;
  children?: ReactNode;
}

export default function Link({ href, children, ...rest }: LinkProps) {
  return <a href={`#${href}`} {...rest}>{children}</a>;
}
