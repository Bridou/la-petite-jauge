import { useEffect, useState, type DragEvent, type FormEvent, type MouseEvent } from 'react'
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  Fuel,
  Gauge,
  Moon,
  MapPin,
  Plus,
  Repeat2,
  Settings2,
  Sun,
  Trash2,
  X,
} from 'lucide-react'

type Settings = { consumption: number; fuel_price: number }
type Trip = { id: number; title: string; distance_km: number; color: string; is_default: number }
type DayTrip = { day: string; trip_id: number }
type Refuel = { id: number; day: string; amount: number; price_per_liter: number | null }
type OneOffTrip = { id: number; day: string; title: string; distance_km: number; color: string }
type RecurringTrip = { trip_id: number; weekdays: number[] }
type AppData = { settings: Settings; trips: Trip[]; day_trips: DayTrip[]; refuels: Refuel[]; recurring_trips: RecurringTrip[]; one_off_trips: OneOffTrip[] }

const weekdays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const weekdayNames = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']
const weekdayShort = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di']
const today = new Date()
const toISODate = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
const dateFromISO = (value: string) => new Date(`${value}T12:00:00`)
const euro = (value: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)
const formatFuelPrice = (value: number) => `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 3 }).format(value)} €/L`
const tripEstimate = (distanceKm: number, consumption: number, fuelPrice: number) => {
  const liters = distanceKm * consumption / 100
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(distanceKm)} km / ${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(liters)} L / ${euro(liters * fuelPrice)}`
}
const compactDate = (value: string) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(dateFromISO(value))
const longDate = (value: string) => new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(dateFromISO(value))
const dateRange = (first: string, last: string) => {
  const start = dateFromISO(first)
  const end = dateFromISO(last)
  const step = start <= end ? 1 : -1
  const days: string[] = []
  const cursor = new Date(start)
  while (true) {
    days.push(toISODate(cursor))
    if (toISODate(cursor) === toISODate(end)) break
    cursor.setDate(cursor.getDate() + step)
  }
  return days
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.detail ?? 'Une erreur est survenue. Réessayez.')
  }
  return response.json() as Promise<T>
}

function App() {
  const [data, setData] = useState<AppData | null>(null)
  const [darkMode, setDarkMode] = useState(() => window.localStorage.getItem('carnet-theme') === 'dark')
  const [selectedDay, setSelectedDay] = useState(toISODate(today))
  const [selectedDays, setSelectedDays] = useState([toISODate(today)])
  const [selectionAnchor, setSelectionAnchor] = useState(toISODate(today))
  const [dragOverDay, setDragOverDay] = useState('')
  const [visibleMonth, setVisibleMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [oneOffOpen, setOneOffOpen] = useState(false)
  const [oneOffTitle, setOneOffTitle] = useState('')
  const [oneOffDistance, setOneOffDistance] = useState('')
  const [consumption, setConsumption] = useState('3.1')
  const [fuelPrice, setFuelPrice] = useState('2.4')
  const [newTripTitle, setNewTripTitle] = useState('')
  const [newTripDistance, setNewTripDistance] = useState('')
  const [refuelAmount, setRefuelAmount] = useState('')
  const [refuelPricePerLiter, setRefuelPricePerLiter] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  async function refresh() {
    const next = await request<AppData>('/state')
    setData(next)
    setConsumption(String(next.settings.consumption))
    setFuelPrice(String(next.settings.fuel_price))
  }

  useEffect(() => {
    refresh().catch(() => setError("L’application ne répond pas. Vérifiez que le serveur local est lancé."))
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light'
    window.localStorage.setItem('carnet-theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  const selectedIds = data?.day_trips.filter((item) => item.day === selectedDay).map((item) => item.trip_id) ?? []
  const selectedTrips = data?.trips.filter((trip) => selectedIds.includes(trip.id)) ?? []
  const selectedOneOffTrips = data?.one_off_trips.filter((trip) => trip.day === selectedDay) ?? []
  const selectedDistance = selectedTrips.reduce((total, trip) => total + trip.distance_km, 0) + selectedOneOffTrips.reduce((total, trip) => total + trip.distance_km, 0)
  const selectedDayTrips = data?.day_trips.filter((item) => selectedDays.includes(item.day)) ?? []
  const selectedDaysRegularDistance = selectedDayTrips.reduce((total, item) => {
    const trip = data?.trips.find((candidate) => candidate.id === item.trip_id)
    return total + (trip?.distance_km ?? 0)
  }, 0)
  const selectedDaysOneOffDistance = (data?.one_off_trips ?? []).filter((trip) => selectedDays.includes(trip.day)).reduce((total, trip) => total + trip.distance_km, 0)
  const selectedDaysDistance = selectedDaysRegularDistance + selectedDaysOneOffDistance
  const summaryDistance = selectedDays.length > 1 ? selectedDaysDistance : selectedDistance
  const summaryLiters = summaryDistance * (data?.settings.consumption ?? 3.1) / 100
  const summaryEstimatedCost = summaryLiters * (data?.settings.fuel_price ?? 2.4)
  const monthPrefix = `${visibleMonth.getFullYear()}-${String(visibleMonth.getMonth() + 1).padStart(2, '0')}`
  const monthlyDays = data?.day_trips.filter((item) => item.day.startsWith(monthPrefix)) ?? []
  const monthlyRegularDistance = monthlyDays.reduce((total, item) => {
    const trip = data?.trips.find((candidate) => candidate.id === item.trip_id)
    return total + (trip?.distance_km ?? 0)
  }, 0)
  const monthlyOneOffTrips = data?.one_off_trips.filter((trip) => trip.day.startsWith(monthPrefix)) ?? []
  const monthlyDistance = monthlyRegularDistance + monthlyOneOffTrips.reduce((total, trip) => total + trip.distance_km, 0)
  const monthlyLiters = monthlyDistance * (data?.settings.consumption ?? 3.1) / 100
  const monthlyEstimatedCost = monthlyLiters * (data?.settings.fuel_price ?? 2.4)
  const monthlyRefuels = data?.refuels.filter((item) => item.day.startsWith(monthPrefix)) ?? []
  const monthlyRefuelSpend = monthlyRefuels.reduce((total, item) => total + item.amount, 0)
  const previousMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1)
  const previousMonthPrefix = `${previousMonth.getFullYear()}-${String(previousMonth.getMonth() + 1).padStart(2, '0')}`
  const previousMonthName = new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(previousMonth)
  const previousMonthDays = data?.day_trips.filter((item) => item.day.startsWith(previousMonthPrefix)) ?? []
  const previousMonthRegularDistance = previousMonthDays.reduce((total, item) => {
    const trip = data?.trips.find((candidate) => candidate.id === item.trip_id)
    return total + (trip?.distance_km ?? 0)
  }, 0)
  const previousMonthOneOffDistance = (data?.one_off_trips ?? []).filter((trip) => trip.day.startsWith(previousMonthPrefix)).reduce((total, trip) => total + trip.distance_km, 0)
  const previousMonthDistance = previousMonthRegularDistance + previousMonthOneOffDistance
  const previousMonthCost = previousMonthDistance * (data?.settings.consumption ?? 3.1) / 100 * (data?.settings.fuel_price ?? 2.4)
  const previousMonthRefuels = data?.refuels.filter((item) => item.day.startsWith(previousMonthPrefix)) ?? []
  const previousMonthRefuelSpend = previousMonthRefuels.reduce((total, item) => total + item.amount, 0)
  const selectedRefuels = data?.refuels.filter((item) => item.day === selectedDay) ?? []
  const lastRefuelBeforeSelected = data?.refuels
    .filter((item) => item.day < selectedDay)
    .sort((left, right) => right.day.localeCompare(left.day))[0]
  const distanceSinceLastRefuel = lastRefuelBeforeSelected
    ? (data?.day_trips ?? []).filter((item) => item.day > lastRefuelBeforeSelected.day && item.day <= selectedDay).reduce((total, item) => {
        const trip = data?.trips.find((candidate) => candidate.id === item.trip_id)
        return total + (trip?.distance_km ?? 0)
      }, 0) + (data?.one_off_trips ?? []).filter((trip) => trip.day > lastRefuelBeforeSelected.day && trip.day <= selectedDay).reduce((total, trip) => total + trip.distance_km, 0)
    : 0
  const litersSinceLastRefuel = distanceSinceLastRefuel * (data?.settings.consumption ?? 3.1) / 100
  const costSinceLastRefuel = litersSinceLastRefuel * (data?.settings.fuel_price ?? 2.4)

  const firstOfMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1)
  const calendarStart = new Date(firstOfMonth)
  calendarStart.setDate(1 - ((firstOfMonth.getDay() + 6) % 7))
  const calendarDays = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(calendarStart)
    date.setDate(calendarStart.getDate() + index)
    return date
  })
  const monthName = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(visibleMonth)
  const comparisonLabel = (current: number, previous: number, format: (value: number) => string) => {
    if (current === previous) return `Stable vs ${previousMonthName}`
    if (previous === 0) return current > 0 ? `Nouveau vs ${previousMonthName}` : `Aucun en ${previousMonthName}`
    const difference = current - previous
    const percent = Math.round(Math.abs(difference / previous) * 100)
    return `${difference > 0 ? '+' : ''}${format(difference)} · ${difference > 0 ? '+' : '-'}${percent} % vs ${previousMonthName}`
  }
  const formatDistance = (value: number) => `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value)} km`
  const activeWeekStart = new Date(dateFromISO(selectedDay))
  activeWeekStart.setDate(activeWeekStart.getDate() - ((activeWeekStart.getDay() + 6) % 7))
  const activeWeekLabel = compactDate(toISODate(activeWeekStart))

  async function updateDayTrips(tripId: number) {
    if (!data || busy) return
    setBusy(true)
    setError('')
    const nextIds = selectedIds.includes(tripId) ? selectedIds.filter((id) => id !== tripId) : [...selectedIds, tripId]
    try {
      await request(`/days/${selectedDay}/trips`, { method: 'PUT', body: JSON.stringify({ trip_ids: nextIds }) })
      await refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Impossible d’enregistrer les trajets.')
    } finally {
      setBusy(false)
    }
  }

  async function addOneOffTrip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await request('/one-off-trips', {
        method: 'POST',
        body: JSON.stringify({ day: selectedDay, title: oneOffTitle, distance_km: Number(oneOffDistance) }),
      })
      setOneOffTitle('')
      setOneOffDistance('')
      setOneOffOpen(false)
      await refresh()
      setNotice('Trajet unique ajouté à cette journée.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Impossible d’ajouter ce trajet unique.')
    } finally {
      setBusy(false)
    }
  }

  async function removeOneOffTrip(tripId: number) {
    setBusy(true)
    setError('')
    try {
      await request(`/one-off-trips/${tripId}`, { method: 'DELETE' })
      await refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Impossible de supprimer ce trajet unique.')
    } finally {
      setBusy(false)
    }
  }

  async function updateRecurrence(tripId: number, weekday: number) {
    if (!data || busy) return
    const current = data.recurring_trips.find((rule) => rule.trip_id === tripId)?.weekdays ?? []
    const next = current.includes(weekday) ? current.filter((day) => day !== weekday) : [...current, weekday].sort()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await request('/recurrences', { method: 'PUT', body: JSON.stringify({ trip_id: tripId, weekdays: next }) })
      await refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Impossible d’enregistrer la récurrence.')
    } finally {
      setBusy(false)
    }
  }

  async function applyRecurringWeek() {
    if (!data || busy || data.recurring_trips.length === 0) return
    const activeDate = dateFromISO(selectedDay)
    activeDate.setDate(activeDate.getDate() - ((activeDate.getDay() + 6) % 7))
    const weekStart = toISODate(activeDate)
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await request<{ days_updated: number }>('/recurrences/apply-week', {
        method: 'POST',
        body: JSON.stringify({ week_start: weekStart }),
      })
      await refresh()
      setNotice(result.days_updated === 0 ? 'Les trajets récurrents étaient déjà ajoutés pour cette semaine.' : `${result.days_updated} trajet${result.days_updated > 1 ? 's' : ''} ajouté${result.days_updated > 1 ? 's' : ''} à cette semaine.`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Impossible d’appliquer les trajets récurrents.')
    } finally {
      setBusy(false)
    }
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await request('/settings', {
        method: 'PUT',
        body: JSON.stringify({ consumption: Number(consumption), fuel_price: Number(fuelPrice) }),
      })
      await refresh()
      setSettingsOpen(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Impossible d’enregistrer les réglages.')
    } finally {
      setBusy(false)
    }
  }

  async function addTrip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await request('/trips', {
        method: 'POST',
        body: JSON.stringify({ title: newTripTitle, distance_km: Number(newTripDistance) }),
      })
      setNewTripTitle('')
      setNewTripDistance('')
      await refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Impossible de créer ce trajet.')
    } finally {
      setBusy(false)
    }
  }

  async function removeTrip(tripId: number) {
    setBusy(true)
    setError('')
    try {
      await request(`/trips/${tripId}`, { method: 'DELETE' })
      await refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Impossible de supprimer ce trajet.')
    } finally {
      setBusy(false)
    }
  }

  async function addRefuel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!refuelAmount || !refuelPricePerLiter) return
    setBusy(true)
    setError('')
    try {
      await request('/refuels', {
        method: 'POST',
        body: JSON.stringify({ date: selectedDay, amount: Number(refuelAmount), price_per_liter: Number(refuelPricePerLiter) }),
      })
      setRefuelAmount('')
      setRefuelPricePerLiter('')
      await refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Impossible d’enregistrer ce plein.')
    } finally {
      setBusy(false)
    }
  }

  async function removeRefuel(refuelId: number) {
    setBusy(true)
    setError('')
    try {
      await request(`/refuels/${refuelId}`, { method: 'DELETE' })
      await refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Impossible de supprimer ce plein.')
    } finally {
      setBusy(false)
    }
  }

  function changeMonth(amount: number) {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1))
  }

  function selectOnlyDay(day: string) {
    setSelectedDay(day)
    setSelectedDays([day])
    setSelectionAnchor(day)
  }

  function handleCalendarDayClick(event: MouseEvent<HTMLButtonElement>, day: string) {
    const additive = event.ctrlKey || event.metaKey
    if (event.shiftKey) {
      const range = dateRange(selectionAnchor, day)
      setSelectedDays(additive ? [...new Set([...selectedDays, ...range])].sort() : range)
    } else if (additive) {
      setSelectedDays(selectedDays.includes(day) ? selectedDays.filter((item) => item !== day) : [...selectedDays, day].sort())
      setSelectionAnchor(day)
    } else {
      selectOnlyDay(day)
    }
    setSelectedDay(day)
  }

  async function applyTripToSelection(tripId: number, targetDay: string) {
    if (!data || busy) return
    const days = selectedDays.includes(targetDay) ? selectedDays : [targetDay]
    setBusy(true)
    setError('')
    try {
      await request('/days/trips', { method: 'PUT', body: JSON.stringify({ days, trip_id: tripId }) })
      await refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Impossible d’appliquer ce trajet aux dates sélectionnées.')
    } finally {
      setBusy(false)
      setDragOverDay('')
    }
  }

  function handleTripDrop(event: DragEvent<HTMLElement>, targetDay: string) {
    event.preventDefault()
    const tripId = Number(event.dataTransfer.getData('text/plain'))
    if (Number.isInteger(tripId) && data?.trips.some((trip) => trip.id === tripId)) void applyTripToSelection(tripId, targetDay)
    else setDragOverDay('')
  }

  if (!data) {
    return <main className="loading-screen"><div className="loading-mark"><Fuel size={21} /></div><p>{error || 'Ouverture de La petite jauge…'}</p></main>
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="La petite jauge, accueil">
          <span className="brand-mark"><Fuel size={20} strokeWidth={2.2} /></span>
          <span className="brand-name">la petite jauge<span>.</span></span>
        </a>
        <div className="topbar-actions">
          <span className="local-badge"><span /> Enregistré sur cet appareil</span>
          <button className="icon-button theme-toggle" onClick={() => setDarkMode((current) => !current)} title={darkMode ? 'Passer en mode clair' : 'Passer en mode sombre'} aria-label={darkMode ? 'Passer en mode clair' : 'Passer en mode sombre'} aria-pressed={darkMode}>{darkMode ? <Sun size={18} /> : <Moon size={18} />}</button>
          <button className="icon-button settings-trigger" onClick={() => setSettingsOpen(true)} title="Réglages" aria-label="Ouvrir les réglages"><Settings2 size={19} /></button>
        </div>
      </header>

      <section className="page-heading">
        <div>
          <p className="eyebrow"><span className="eyebrow-line" /> TRAJETS · CONSOMMATION · PLEINS</p>
          <h1>Votre voiture,<br className="mobile-break" /> en un coup d’œil.</h1>
          <p className="heading-caption">Retrouvez trajets, kilomètres et pleins au même endroit.</p>
        </div>
        <div className="heading-note"><CalendarDays size={17} /><span>Un suivi simple, au quotidien.</span></div>
      </section>

      <section className="monthly-report" aria-label={`Bilan de ${monthName}`}>
        <div className="monthly-report-heading"><span className="section-kicker">BILAN MENSUEL</span><strong>{monthName}</strong></div>
        <div className="stats-grid">
        <article className="stat-card stat-distance">
          <div className="stat-top"><span>Distance du mois</span><span className="stat-icon"><MapPin size={17} /></span></div>
          <strong>{new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(monthlyDistance)} <small>km</small></strong>
          <p className="stat-comparison">{comparisonLabel(monthlyDistance, previousMonthDistance, formatDistance)}</p>
        </article>
        <article className="stat-card stat-consumption">
          <div className="stat-top"><span>Coût estimé</span><span className="stat-icon"><Gauge size={17} /></span></div>
          <strong>{euro(monthlyEstimatedCost)}</strong>
          <p className="stat-comparison">{new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(monthlyLiters)} L · {comparisonLabel(monthlyEstimatedCost, previousMonthCost, euro)}</p>
        </article>
        <article className="stat-card stat-refuel">
          <div className="stat-top"><span>Pleins enregistrés</span><span className="stat-icon"><Fuel size={17} /></span></div>
          <strong>{euro(monthlyRefuelSpend)}</strong>
          <p className="stat-comparison">{monthlyRefuels.length} plein{monthlyRefuels.length > 1 ? 's' : ''} · {comparisonLabel(monthlyRefuelSpend, previousMonthRefuelSpend, euro)}</p>
        </article>
        </div>
      </section>

      {error && <div className="error-banner" role="alert"><span>{error}</span><button className="bare-button" onClick={() => setError('')} aria-label="Fermer le message"><X size={16} /></button></div>}
      {notice && <div className="notice-banner" role="status"><span>{notice}</span><button className="bare-button" onClick={() => setNotice('')} aria-label="Fermer le message"><X size={16} /></button></div>}

      <section className="workspace-grid">
        <section className="calendar-panel" aria-label="Calendrier des trajets">
          <div className="calendar-heading">
            <div className="calendar-title"><span className="section-kicker">LE CALENDRIER</span><h2>{monthName}</h2></div>
            <div className="month-controls">
              <button className="icon-button" onClick={() => changeMonth(-1)} aria-label="Mois précédent"><ArrowLeft size={17} /></button>
              <button className="today-button" onClick={() => { setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1)); selectOnlyDay(toISODate(today)) }}>Aujourd’hui</button>
              <button className="icon-button" onClick={() => changeMonth(1)} aria-label="Mois suivant"><ArrowRight size={17} /></button>
            </div>
          </div>
          <div className="calendar-actions">
            <button className="week-action" onClick={() => data.recurring_trips.length ? void applyRecurringWeek() : setSettingsOpen(true)} disabled={busy} title={`Appliquer les trajets récurrents à la semaine du ${activeWeekLabel}`}><Repeat2 size={15} />{data.recurring_trips.length ? 'Ajouter cette semaine' : 'Configurer les récurrences'}</button>
            <span className="week-action-caption">Semaine du {activeWeekLabel}</span>
          </div>
          {selectedDays.length > 1 && <div className={`selection-count${dragOverDay === 'selection' ? ' is-drop-target' : ''}`} role="status" aria-live="polite" title="Déposer un trajet ici pour l’ajouter à tous les jours sélectionnés" onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; setDragOverDay('selection') }} onDragLeave={(event) => { if (event.currentTarget === event.target) setDragOverDay('') }} onDrop={(event) => handleTripDrop(event, selectedDays[0])}><CalendarDays size={13} />{selectedDays.length} jours sélectionnés</div>}
          <div className="calendar-grid calendar-weekdays" aria-hidden="true">
            {weekdays.map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="calendar-grid calendar-days">
            {calendarDays.map((date) => {
              const iso = toISODate(date)
              const inMonth = date.getMonth() === visibleMonth.getMonth()
              const dayTrips = data.day_trips.filter((item) => item.day === iso)
              const dayTripItems = [
                ...dayTrips.flatMap((item) => {
                  const trip = data.trips.find((candidate) => candidate.id === item.trip_id)
                  return trip ? [{ key: `saved-${trip.id}`, title: trip.title, color: trip.color }] : []
                }),
                ...data.one_off_trips.filter((trip) => trip.day === iso).map((trip) => ({ key: `unique-${trip.id}`, title: trip.title, color: trip.color })),
              ]
              const dayRefuels = data.refuels.filter((item) => item.day === iso)
              return (
                <button
                  key={iso}
                  className={`day-cell${inMonth ? '' : ' outside-month'}${selectedDays.includes(iso) ? ' is-selected' : ''}${iso === selectedDay ? ' is-active-day' : ''}${iso === toISODate(today) ? ' is-today' : ''}${dragOverDay === iso ? ' is-drop-target' : ''}`}
                  onClick={(event) => handleCalendarDayClick(event, iso)}
                  onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; setDragOverDay(iso) }}
                  onDragLeave={(event) => { if (event.currentTarget === event.target) setDragOverDay('') }}
                  onDrop={(event) => {
                    handleTripDrop(event, iso)
                  }}
                  aria-label={`${longDate(iso)}${dayTripItems.length ? `, ${dayTripItems.length} trajet${dayTripItems.length > 1 ? 's' : ''}` : ''}${dayRefuels.length ? ', plein enregistré' : ''}`}
                  aria-pressed={selectedDays.includes(iso)}
                >
                  <span className="day-number">{date.getDate()}</span>
                  <span className="day-indicators">
                    {dayTripItems.slice(0, 3).map((trip) => <i key={trip.key} className="trip-dot" style={{ backgroundColor: trip.color }} title={trip.title} />)}
                    {dayRefuels.length > 0 && <span className="refuel-indicator" title="Plein enregistré"><Fuel size={10} /></span>}
                  </span>
                  {dayTripItems.length > 0 && <span className="day-trip-names">{dayTripItems.slice(0, 2).map((trip) => <span className="day-caption" key={trip.key}>{trip.title}</span>)}{dayTripItems.length > 2 && <span className="day-caption day-overflow">+{dayTripItems.length - 2}</span>}</span>}
                </button>
              )
            })}
          </div>
          <div className="calendar-footer">
            <div className="legend"><span><i className="legend-dot" /> Trajet effectué</span><span><Fuel size={12} /> Plein noté</span></div>
            <div className="calendar-distance"><span>{monthlyDays.length + monthlyOneOffTrips.length} trajets</span><b>{new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(monthlyDistance)} km</b></div>
          </div>
        </section>

        <aside className="day-panel">
          <div className="day-panel-heading">
            <div><span className="section-kicker">{selectedDays.length > 1 ? 'VOTRE SÉLECTION' : 'VOTRE JOURNÉE'}</span><h2>{selectedDays.length > 1 ? `${selectedDays.length} jours sélectionnés` : longDate(selectedDay)}</h2>{selectedDays.length > 1 && <p className="selection-active-day">Jour actif : {longDate(selectedDay)}</p>}</div>
            <span className="day-date-icon"><CalendarDays size={18} /></span>
          </div>
          <div className="day-total">
            <div><span>{selectedDays.length > 1 ? 'Distance sélectionnée' : 'Distance du jour'}</span><strong>{new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(summaryDistance)} <small>km</small></strong></div>
            <div className="day-total-divider" />
            <div><span>Essence estimée</span><strong>{new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(summaryLiters)} <small>L</small></strong></div>
            <div className="day-total-divider" />
            <div><span>Coût estimé</span><strong>{euro(summaryEstimatedCost)}</strong></div>
          </div>
          <section className="since-refuel" aria-label="Consommation depuis le dernier plein">
            <div className="since-refuel-heading"><div><span className="section-kicker">DEPUIS LE DERNIER PLEIN</span><strong>{lastRefuelBeforeSelected ? `Du ${compactDate(lastRefuelBeforeSelected.day)} au ${compactDate(selectedDay)}` : 'Pas de plein antérieur'}</strong></div>{lastRefuelBeforeSelected && <span className="since-refuel-paid">Payé {euro(lastRefuelBeforeSelected.amount)}{lastRefuelBeforeSelected.price_per_liter !== null && ` · ${formatFuelPrice(lastRefuelBeforeSelected.price_per_liter)}`}</span>}</div>
            {lastRefuelBeforeSelected ? <div className="since-refuel-metrics"><div><span>Distance</span><strong>{new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(distanceSinceLastRefuel)} <small>km</small></strong></div><div><span>Essence estimée</span><strong>{new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(litersSinceLastRefuel)} <small>L</small></strong></div><div><span>Coût estimé</span><strong>{euro(costSinceLastRefuel)}</strong></div></div> : <p className="since-refuel-empty">Ajoutez un plein antérieur pour commencer ce suivi.</p>}
          </section>

          <div className="side-section trips-section">
            <div className="side-section-heading"><h3>{selectedDays.length > 1 ? 'Trajets du jour actif' : 'Trajets'}</h3><span>{selectedTrips.length + selectedOneOffTrips.length} enregistré{selectedTrips.length + selectedOneOffTrips.length !== 1 ? 's' : ''}</span></div>
            <div className="trip-choice-list">
              {data.trips.map((trip) => {
                const active = selectedIds.includes(trip.id)
                return (
                  <button key={trip.id} className={`trip-choice${active ? ' active' : ''}`} onClick={() => updateDayTrips(trip.id)} disabled={busy} draggable={!busy} onDragStart={(event) => { event.dataTransfer.setData('text/plain', String(trip.id)); event.dataTransfer.effectAllowed = 'copy' }} title="Glisser sur un jour sélectionné pour ajouter ce trajet aux dates choisies" aria-pressed={active}>
                    <span className="trip-color" style={{ backgroundColor: trip.color }} />
                    <span className="trip-choice-copy"><span className="trip-choice-name">{trip.title}</span><span className="trip-choice-stats">{tripEstimate(trip.distance_km, data.settings.consumption, data.settings.fuel_price)}</span></span>
                    <span className="trip-check">{active ? <Check size={14} /> : <Plus size={14} />}</span>
                  </button>
                )
              })}
            </div>
            {selectedOneOffTrips.length > 0 && <ul className="one-off-list" aria-label="Trajets uniques de la journée">{selectedOneOffTrips.map((trip) => <li key={trip.id}><span className="trip-color" style={{ backgroundColor: trip.color }} /><span className="one-off-name">{trip.title}<small>Trajet unique</small><span className="one-off-stats">{tripEstimate(trip.distance_km, data.settings.consumption, data.settings.fuel_price)}</span></span><button className="bare-button" onClick={() => removeOneOffTrip(trip.id)} aria-label={`Supprimer le trajet unique ${trip.title}`}><Trash2 size={14} /></button></li>)}</ul>}
            <button className="text-action" onClick={() => setOneOffOpen(true)}><Plus size={14} /> Créer un trajet unique</button>
          </div>

          <div className="side-section refuel-section">
            <div className="side-section-heading"><h3>Plein d’essence</h3><span>Le {compactDate(selectedDay)}</span></div>
            <form className="refuel-form" onSubmit={addRefuel}>
              <label className="sr-only" htmlFor="refuel-amount">Montant payé en euros</label>
              <div className="amount-input"><span>€</span><input id="refuel-amount" type="number" min="0.01" max="1000" step="0.01" placeholder="Total payé" value={refuelAmount} onChange={(event) => setRefuelAmount(event.target.value)} required /></div>
              <label className="sr-only" htmlFor="refuel-price-per-liter">Prix de l’essence par litre en euros</label>
              <div className="amount-input"><span>€/L</span><input id="refuel-price-per-liter" type="number" min="0.01" max="20" step="0.001" placeholder="Prix / L" value={refuelPricePerLiter} onChange={(event) => setRefuelPricePerLiter(event.target.value)} required /></div>
              <button className="add-refuel-button" type="submit" disabled={busy || !refuelAmount || !refuelPricePerLiter} aria-label="Enregistrer le plein"><ArrowDownLeft size={17} /></button>
            </form>
            {selectedRefuels.length > 0 ? (
              <ul className="refuel-list">
                {selectedRefuels.map((refuel) => <li key={refuel.id}><span><Fuel size={14} /> Plein enregistré</span><strong>{euro(refuel.amount)}{refuel.price_per_liter !== null && <small>{formatFuelPrice(refuel.price_per_liter)}</small>}</strong><button className="bare-button delete-refuel" onClick={() => removeRefuel(refuel.id)} aria-label="Supprimer ce plein"><Trash2 size={14} /></button></li>)}
              </ul>
            ) : <p className="empty-refuels">Aucun plein noté pour cette journée.</p>}
          </div>

          {monthlyRefuels.length > 0 && <div className="month-refuels"><div className="side-section-heading"><h3>Derniers pleins</h3><ChevronDown size={15} /></div>{monthlyRefuels.slice(0, 3).map((refuel) => <button className="month-refuel-row" key={refuel.id} onClick={() => selectOnlyDay(refuel.day)}><span>{compactDate(refuel.day)}</span><span className="month-refuel-line" /><strong>{euro(refuel.amount)}</strong></button>)}</div>}
        </aside>
      </section>

      <footer className="page-footer"><span>Une estimation basée sur {new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(data.settings.consumption)} L / 100 km</span><button onClick={() => setSettingsOpen(true)}>Ajuster les réglages <ArrowRight size={14} /></button></footer>

      {oneOffOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOneOffOpen(false) }}>
          <section className="one-off-modal" role="dialog" aria-modal="true" aria-labelledby="one-off-title">
            <div className="modal-heading"><div><span className="section-kicker">{longDate(selectedDay)}</span><h2 id="one-off-title">Trajet unique</h2></div><button className="icon-button" onClick={() => setOneOffOpen(false)} aria-label="Fermer"><X size={19} /></button></div>
            <p className="one-off-intro">Ce trajet sera ajouté uniquement à cette journée.</p>
            <form className="one-off-form" onSubmit={addOneOffTrip}>
              <label htmlFor="one-off-title-input">Nom du trajet<input id="one-off-title-input" type="text" maxLength={40} placeholder="Ex. Rendez-vous" value={oneOffTitle} onChange={(event) => setOneOffTitle(event.target.value)} required autoFocus /></label>
              <label htmlFor="one-off-distance-input">Distance aller-retour<span className="distance-input"><input id="one-off-distance-input" type="number" min="0.1" max="1000" step="0.1" placeholder="Distance" value={oneOffDistance} onChange={(event) => setOneOffDistance(event.target.value)} required /><span>km</span></span></label>
              <button className="save-button" type="submit" disabled={busy}>Ajouter à cette journée <ArrowRight size={16} /></button>
            </form>
          </section>
        </div>
      )}

      {settingsOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSettingsOpen(false) }}>
          <section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
            <div className="modal-heading"><div><span className="section-kicker">PERSONNALISATION</span><h2 id="settings-title">Les réglages</h2></div><button className="icon-button" onClick={() => setSettingsOpen(false)} aria-label="Fermer les réglages"><X size={19} /></button></div>
            <form className="settings-form" onSubmit={saveSettings}>
              <label>Consommation moyenne<span className="field-with-unit"><input type="number" min="0.1" max="30" step="0.1" value={consumption} onChange={(event) => setConsumption(event.target.value)} required /><small>L / 100 km</small></span></label>
              <label>Prix de l’essence<span className="field-with-unit"><input type="number" min="0.01" max="20" step="0.001" value={fuelPrice} onChange={(event) => setFuelPrice(event.target.value)} required /><small>€ / litre</small></span></label>
              <button className="save-button" type="submit" disabled={busy}>Enregistrer les réglages <ArrowRight size={16} /></button>
            </form>
            <div className="modal-divider" />
            <div className="custom-trips-heading"><div><span className="section-kicker">VOS HABITUDES</span><h3>Trajets enregistrés</h3></div><span>{data.trips.length} trajet{data.trips.length > 1 ? 's' : ''}</span></div>
            <ul className="settings-trip-list">
              {data.trips.map((trip) => {
                const recurringDays = data.recurring_trips.find((rule) => rule.trip_id === trip.id)?.weekdays ?? []
                return <li className="settings-trip-entry" key={trip.id}>
                  <div className="settings-trip-top"><span className="trip-color" style={{ backgroundColor: trip.color }} /><span className="settings-trip-name">{trip.title}</span><span className="settings-trip-distance">{new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(trip.distance_km)} km</span>{trip.is_default ? <span className="default-tag">par défaut</span> : <button className="bare-button" onClick={() => removeTrip(trip.id)} aria-label={`Supprimer le trajet ${trip.title}`}><Trash2 size={15} /></button>}</div>
                  <div className="recurrence-control"><span>Répéter</span><div className="recurrence-days">{weekdayShort.map((label, weekday) => <button className={`weekday-chip${recurringDays.includes(weekday) ? ' active' : ''}`} key={`${trip.id}-${weekday}`} type="button" onClick={() => updateRecurrence(trip.id, weekday)} disabled={busy} aria-label={`${recurringDays.includes(weekday) ? 'Retirer' : 'Ajouter'} ${weekdayNames[weekday]} pour ${trip.title}`} aria-pressed={recurringDays.includes(weekday)} title={weekdayNames[weekday]}>{label}</button>)}</div></div>
                </li>
              })}
            </ul>
            <form className="new-trip-form" onSubmit={addTrip}>
              <span className="new-trip-label">Ajouter un trajet</span>
              <div className="new-trip-fields"><label className="sr-only" htmlFor="trip-title">Nom du trajet</label><input id="trip-title" type="text" maxLength={40} placeholder="Ex. Piscine" value={newTripTitle} onChange={(event) => setNewTripTitle(event.target.value)} required /><label className="sr-only" htmlFor="trip-distance">Distance aller-retour en kilomètres</label><div className="distance-input"><input id="trip-distance" type="number" min="0.1" max="1000" step="0.1" placeholder="Distance" value={newTripDistance} onChange={(event) => setNewTripDistance(event.target.value)} required /><span>km</span></div><button className="add-trip-button" type="submit" disabled={busy} aria-label="Ajouter ce trajet"><Plus size={18} /></button></div>
              <p>Indiquez la distance aller-retour.</p>
            </form>
          </section>
        </div>
      )}
    </main>
  )
}

export default App
