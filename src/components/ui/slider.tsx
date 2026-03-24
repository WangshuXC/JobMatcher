"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { Slider as SliderPrimitive } from "@base-ui/react/slider"

import { cn } from "@/lib/utils"

/**
 * 内部 Slider 实现（仅客户端渲染）
 *
 * Base UI Slider 在 SSR 时使用 CSS 变量 + <script> prehydration，
 * 客户端 hydration 时计算出具体数值，导致 HTML 不匹配。
 * 通过 next/dynamic ssr:false 彻底跳过 SSR。
 */
function SliderImpl({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  ...props
}: SliderPrimitive.Root.Props) {
  const _values = React.useMemo(
    () =>
      Array.isArray(value)
        ? value
        : Array.isArray(defaultValue)
          ? defaultValue
          : [min, max],
    [value, defaultValue, min, max]
  )

  return (
    <SliderPrimitive.Root
      className={cn("data-horizontal:w-full data-vertical:h-full", className)}
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      {...props}
    >
      <SliderPrimitive.Control className="relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col">
        <SliderPrimitive.Track
          data-slot="slider-track"
          className="relative grow overflow-hidden rounded-full bg-muted select-none data-horizontal:h-1 data-horizontal:w-full data-vertical:h-full data-vertical:w-1"
        >
          <SliderPrimitive.Indicator
            data-slot="slider-range"
            className="bg-primary select-none data-horizontal:h-full data-vertical:w-full"
          />
        </SliderPrimitive.Track>
        {Array.from({ length: _values.length }, (_, index) => (
          <SliderPrimitive.Thumb
            data-slot="slider-thumb"
            key={index}
            className="relative block size-3 shrink-0 rounded-full border border-ring bg-white ring-ring/50 transition-[color,box-shadow] select-none after:absolute after:-inset-2 hover:ring-3 focus-visible:ring-3 focus-visible:outline-hidden active:ring-3 disabled:pointer-events-none disabled:opacity-50"
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}

/** SSR 占位：与 Slider 等高的静态轨道，避免布局跳动 */
function SliderFallback({ className }: { className?: string }) {
  return (
    <div
      data-slot="slider"
      className={cn("data-horizontal:w-full data-vertical:h-full", className)}
    >
      <div className="relative flex w-full touch-none items-center select-none h-3">
        <div
          data-slot="slider-track"
          className="relative grow overflow-hidden rounded-full bg-muted select-none h-1 w-full"
        />
      </div>
    </div>
  )
}

const Slider = dynamic(() => Promise.resolve(SliderImpl), {
  ssr: false,
  loading: () => <SliderFallback />,
})

export { Slider }
