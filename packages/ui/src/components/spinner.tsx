import * as React from "react";
import { cn } from "../lib/utils";

export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Size of the spinner.
   * - `xs`: compact for inline text/buttons
   * - `sm`: small indicator
   * - `md`: default section loader
   * - `lg`: view / stage loader
   */
  size?: "xs" | "sm" | "md" | "lg";
  /**
   * Layout variant.
   * - `inline`: standard inline element
   * - `centered`: centered container filling parent height/space
   * - `fullscreen`: full viewport overlay
   */
  variant?: "inline" | "centered" | "fullscreen";
  /**
   * Optional text label displayed below the spinner.
   */
  label?: string;
}

const sizeConfig = {
  xs: { square: 6, offset: 8, radius: 1 },
  sm: { square: 9, offset: 12, radius: 1.5 },
  md: { square: 14, offset: 18, radius: 2.5 },
  lg: { square: 22, offset: 28, radius: 4 },
};

/**
 * 2D Rubik's Lateral White Sticker Spinner.
 * Renders 5 white sticker tiles moving laterally across grid paths in sliding sequence.
 */
export function Spinner({
  size = "md",
  variant = "inline",
  label,
  className,
  ...props
}: SpinnerProps) {
  const cfg = sizeConfig[size] || sizeConfig.md;

  const styleObj = {
    "--cf-spinner-sq": `${cfg.square}px`,
    "--cf-spinner-offset": `${cfg.offset}px`,
    "--cf-spinner-radius": `${cfg.radius}px`,
  } as React.CSSProperties;

  const contentNode = (
    <>
      <div className="cf-rubik-lateral-spinner" aria-label="Cargando">
        <div className="cf-rubik-lateral-square cf-sq-1" />
        <div className="cf-rubik-lateral-square cf-sq-2" />
        <div className="cf-rubik-lateral-square cf-sq-3" />
        <div className="cf-rubik-lateral-square cf-sq-4" />
        <div className="cf-rubik-lateral-square cf-sq-5" />
      </div>
      {label && (
        <span className="text-xs font-medium text-muted-foreground animate-pulse">
          {label}
        </span>
      )}
    </>
  );

  if (variant === "fullscreen") {
    return (
      <div
        className={cn(
          "fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm",
          className
        )}
      >
        <div
          className="cf-rubik-spinner-container inline-flex flex-col items-center justify-center gap-3"
          style={styleObj}
          {...props}
        >
          {contentNode}
        </div>
      </div>
    );
  }

  if (variant === "centered") {
    return (
      <div
        className={cn(
          "flex flex-1 h-full min-h-[200px] w-full items-center justify-center p-6 my-auto self-center",
          className
        )}
      >
        <div
          className="cf-rubik-spinner-container inline-flex flex-col items-center justify-center gap-3"
          style={styleObj}
          {...props}
        >
          {contentNode}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "cf-rubik-spinner-container inline-flex flex-col items-center justify-center gap-3",
        className
      )}
      style={styleObj}
      {...props}
    >
      {contentNode}
    </div>
  );
}

export { Spinner as CubeSpinner, Spinner as RubikSpinner };
