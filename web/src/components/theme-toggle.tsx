import { Monitor, Moon, Sun } from 'lucide-react'
import { Icon } from '@astryxdesign/core/Icon'
import {
  SegmentedControl,
  SegmentedControlItem,
} from '@astryxdesign/core/SegmentedControl'
import { Tooltip } from '@astryxdesign/core/Tooltip'

import { isThemeMode, useColorScheme } from '@/lib/theme'

const OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const

export function ThemeToggle() {
  const { preference, setPreference } = useColorScheme()

  return (
    <SegmentedControl
      value={preference}
      onChange={(value) => {
        if (isThemeMode(value)) {
          setPreference(value)
        }
      }}
      label="Colour scheme"
    >
      {OPTIONS.map(({ value, label, icon }) => (
        // Tooltip text and accessible name must match (WCAG label in name).
        <Tooltip key={value} content={label}>
          <SegmentedControlItem
            value={value}
            label={label}
            isLabelHidden
            icon={<Icon icon={icon} size="sm" />}
          />
        </Tooltip>
      ))}
    </SegmentedControl>
  )
}
