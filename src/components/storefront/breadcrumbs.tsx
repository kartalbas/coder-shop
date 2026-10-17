import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <Breadcrumb aria-label="Brotkrumen-Navigation">
      <BreadcrumbList>
        {items.map((item, index) => (
          // Issue #26: only <li> (BreadcrumbItem) may be a direct child of the list.
          <BreadcrumbItem key={item.label} className="flex items-center gap-1.5">
            {index > 0 && <BreadcrumbSeparator />}
            {item.href ? (
              <BreadcrumbLink asChild>
                <Link href={item.href}>{item.label}</Link>
              </BreadcrumbLink>
            ) : (
              <BreadcrumbPage>{item.label}</BreadcrumbPage>
            )}
          </BreadcrumbItem>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
