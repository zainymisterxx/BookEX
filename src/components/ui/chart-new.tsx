"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

// Simple chart configuration type
export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode
    icon?: React.ComponentType
    color?: string
  }
}

type ChartContextProps = {
  config: ChartConfig
}

const ChartContext = React.createContext<ChartContextProps | null>(null)

function useChart() {
  const context = React.useContext(ChartContext)

  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />")
  }

  return context
}

// Simple chart container component
const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    config: ChartConfig
    children: React.ReactNode
  }
>(({ id, className, children, config, ...props }, ref) => {
  const uniqueId = React.useId()
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        ref={ref}
        className={cn(
          "flex aspect-video justify-center text-xs",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </ChartContext.Provider>
  )
})
ChartContainer.displayName = "ChartContainer"

// Simple bar chart component using CSS
interface SimpleBarChartProps {
  data: Array<{ name: string; value: number }>
  className?: string
}

const SimpleBarChart = React.forwardRef<HTMLDivElement, SimpleBarChartProps>(
  ({ data, className, ...props }, ref) => {
    const maxValue = Math.max(...data.map(item => item.value))
    
    return (
      <div
        ref={ref}
        className={cn("flex h-64 items-end space-x-2 p-4", className)}
        {...props}
      >
        {data.map((item, index) => (
          <div key={index} className="flex flex-col items-center space-y-2 flex-1">
            <div
              className="bg-primary transition-all duration-300 w-full rounded-t"
              style={{
                height: `${(item.value / maxValue) * 100}%`,
                minHeight: '4px'
              }}
            />
            <span className="text-xs text-muted-foreground text-center">
              {item.name}
            </span>
            <span className="text-xs font-medium">{item.value}</span>
          </div>
        ))}
      </div>
    )
  }
)
SimpleBarChart.displayName = "SimpleBarChart"

// Simple line chart component using CSS
interface SimpleLineChartProps {
  data: Array<{ name: string; value: number }>
  className?: string
}

const SimpleLineChart = React.forwardRef<HTMLDivElement, SimpleLineChartProps>(
  ({ data, className, ...props }, ref) => {
    const maxValue = Math.max(...data.map(item => item.value))
    const minValue = Math.min(...data.map(item => item.value))
    const range = maxValue - minValue
    
    return (
      <div
        ref={ref}
        className={cn("relative h-64 p-4", className)}
        {...props}
      >
        <svg className="absolute inset-4 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <polyline
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="0.5"
            points={data.map((item, index) => {
              const x = (index / (data.length - 1)) * 100
              const y = 100 - ((item.value - minValue) / range) * 100
              return `${x},${y}`
            }).join(' ')}
          />
          {data.map((item, index) => {
            const x = (index / (data.length - 1)) * 100
            const y = 100 - ((item.value - minValue) / range) * 100
            return (
              <circle
                key={index}
                cx={x}
                cy={y}
                r="1"
                fill="hsl(var(--primary))"
              />
            )
          })}
        </svg>
        <div className="absolute bottom-0 left-4 right-4 flex justify-between">
          {data.map((item, index) => (
            <div key={index} className="text-xs text-muted-foreground text-center">
              <div>{item.name}</div>
              <div className="font-medium">{item.value}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }
)
SimpleLineChart.displayName = "SimpleLineChart"

// Chart tooltip component
const ChartTooltip = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    active?: boolean
    label?: string
    payload?: any[]
  }
>(({ className, active, label, payload, ...props }, ref) => {
  if (!active || !payload || payload.length === 0) {
    return null
  }

  return (
    <div
      ref={ref}
      className={cn(
        "rounded-lg border bg-background p-2 text-sm shadow-md",
        className
      )}
      {...props}
    >
      {label && <div className="font-medium">{label}</div>}
      {payload.map((item, index) => (
        <div key={index} className="flex items-center space-x-2">
          <div
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <span>{item.name}: {item.value}</span>
        </div>
      ))}
    </div>
  )
})
ChartTooltip.displayName = "ChartTooltip"

// Chart tooltip content component
const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    active?: boolean
    payload?: any[]
    label?: string
    indicator?: "line" | "dot" | "dashed"
    hideLabel?: boolean
    hideIndicator?: boolean
    labelFormatter?: (label: any, payload: any[]) => React.ReactNode
    labelClassName?: string
    formatter?: (value: any, name: any, item: any, index: number) => React.ReactNode
  }
>(
  (
    {
      active,
      payload,
      label,
      labelFormatter,
      labelClassName,
      formatter,
      indicator = "dot",
      hideLabel = false,
      hideIndicator = false,
      className,
      ...props
    },
    ref
  ) => {
    const { config } = useChart()

    if (!active || !payload || payload.length === 0) {
      return null
    }

    return (
      <div
        ref={ref}
        className={cn(
          "grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl",
          className
        )}
        {...props}
      >
        {!hideLabel && (
          <p className={cn("font-medium", labelClassName)}>
            {labelFormatter ? labelFormatter(label, payload) : label}
          </p>
        )}
        <div className="grid gap-1.5">
          {payload.map((item, index) => {
            const itemConfig = config[item.dataKey] || {}
            const indicatorColor = item.color || itemConfig.color || 'hsl(var(--primary))'

            return (
              <div
                key={index}
                className="flex w-full items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-muted-foreground"
              >
                {!hideIndicator && (
                  <div
                    className="shrink-0 rounded-[2px] border-[--color-border] bg-[--color-bg]"
                    style={{
                      "--color-bg": indicatorColor,
                      "--color-border": indicatorColor,
                    } as React.CSSProperties}
                  />
                )}
                <div className="flex flex-1 justify-between leading-none">
                  <div className="grid gap-1.5">
                    <span className="text-muted-foreground">
                      {itemConfig.label || item.name}
                    </span>
                  </div>
                  <span className="font-mono font-medium tabular-nums text-foreground">
                    {formatter ? formatter(item.value, item.name, item, index) : item.value}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }
)
ChartTooltipContent.displayName = "ChartTooltipContent"

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  SimpleBarChart,
  SimpleLineChart,
  useChart
}
