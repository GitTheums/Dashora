import { useTheme } from "@dashora/ui";
import { DashoraMark } from "../dashboard/icons.js";

export type BrandMarkProps = {
  className?: string;
  /** Fallback product name when branding.appName is unset. */
  fallbackName?: string;
  showName?: boolean;
  nameClassName?: string;
};

export function BrandMark({
  className,
  fallbackName = "Dashora",
  showName = false,
  nameClassName,
}: BrandMarkProps) {
  const { branding } = useTheme();
  const name = branding.appName?.trim() || fallbackName;

  return (
    <>
      {branding.logoDataUrl ? (
        <img src={branding.logoDataUrl} alt="" className={className} width={28} height={28} />
      ) : (
        <DashoraMark className={className} />
      )}
      {showName ? <span className={nameClassName}>{name}</span> : null}
    </>
  );
}

export function useBrandName(fallbackName = "Dashora"): string {
  const { branding } = useTheme();
  return branding.appName?.trim() || fallbackName;
}
