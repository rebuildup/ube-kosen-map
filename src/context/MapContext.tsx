import { createContext, useContext, useReducer, useMemo, type ReactNode } from 'react'
import type { MapState, MapAction } from '../types'
import { mapReducer, createInitialState } from '../state/reducer'

interface MapContextValue extends MapState {
  dispatch: React.Dispatch<MapAction>
}

const MapContext = createContext<MapContextValue | null>(null)

interface MapProviderProps {
  children: ReactNode
  initialState?: Partial<MapState>
}

export function MapProvider({ children, initialState }: MapProviderProps) {
  const [state, dispatch] = useReducer(mapReducer, {
    ...createInitialState(),
    ...initialState,
  })

  const value = useMemo(() => ({
    ...state,
    dispatch,
  }), [state])

  return (
    <MapContext.Provider value={value}>
      {children}
    </MapContext.Provider>
  )
}

export function useMap(): MapContextValue {
  const context = useContext(MapContext)
  if (!context) {
    throw new Error('useMap must be used within a MapProvider')
  }
  return context
}
