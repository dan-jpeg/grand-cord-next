const SHIPPO_API = 'https://api.goshippo.com'

const FROM_ADDRESS = {
    name: 'Grand Cord',
    street1: '4200 W Grand Ave',
    city: 'Chicago',
    state: 'IL',
    zip: '60651',
    country: 'US',
    phone: '3125550100',
    email: 'shipping@grand-cord.com',
} as const

// One default parcel for all demo orders. Adjust if/when we add real packing.
const DEFAULT_PARCEL = {
    length: '12',
    width: '9',
    height: '3',
    distance_unit: 'in',
    weight: '12',
    mass_unit: 'oz',
} as const

type ShippoAddress = {
    name?: string
    street1: string
    street2?: string
    city: string
    state: string
    zip: string
    country: string
}

type ShippoRate = {
    object_id: string
    amount: string
    currency: string
    provider: string
    servicelevel: { name: string; token: string }
    estimated_days?: number
}

type ShippoShipment = {
    object_id: string
    rates: ShippoRate[]
    messages?: Array<{ text: string }>
}

type ShippoTransaction = {
    object_id: string
    status: 'SUCCESS' | 'ERROR' | 'QUEUED' | 'WAITING'
    tracking_number?: string
    tracking_url_provider?: string
    label_url?: string
    messages?: Array<{ text: string }>
}

async function shippo<T>(path: string, body: unknown): Promise<T> {
    const token = process.env.SHIPPO_API_KEY
    if (!token) throw new Error('SHIPPO_API_KEY is not set')

    const res = await fetch(`${SHIPPO_API}${path}`, {
        method: 'POST',
        headers: {
            Authorization: `ShippoToken ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    })
    if (!res.ok) {
        const text = await res.text()
        throw new Error(`Shippo ${path} failed: ${res.status} ${text}`)
    }
    return res.json() as Promise<T>
}

export type ShippoQuote = {
    rateId: string
    amount: string
    currency: string
    provider: string
    serviceName: string
    estimatedDays: number | null
}

export async function getCheapestQuote(toAddress: ShippoAddress): Promise<ShippoQuote> {
    const shipment = await shippo<ShippoShipment>('/shipments/', {
        address_from: FROM_ADDRESS,
        address_to: toAddress,
        parcels: [DEFAULT_PARCEL],
        async: false,
    })

    if (!shipment.rates?.length) {
        const msgs = shipment.messages?.map(m => m.text).join('; ') ?? 'no rates returned'
        throw new Error(`Shippo returned no rates: ${msgs}`)
    }

    const uspsRates = shipment.rates.filter(r => r.provider.toUpperCase() === 'USPS')
    if (!uspsRates.length) {
        throw new Error('No USPS rates available for this address')
    }
    const cheapest = uspsRates.sort(
        (a, b) => parseFloat(a.amount) - parseFloat(b.amount)
    )[0]

    return {
        rateId: cheapest.object_id,
        amount: cheapest.amount,
        currency: cheapest.currency,
        provider: cheapest.provider,
        serviceName: cheapest.servicelevel.name,
        estimatedDays: cheapest.estimated_days ?? null,
    }
}

export async function buyLabel(rateId: string): Promise<{
    trackingNumber: string
    trackingUrl: string | null
    labelUrl: string
}> {
    const tx = await shippo<ShippoTransaction>('/transactions/', {
        rate: rateId,
        label_file_type: 'PDF',
        async: false,
    })

    if (tx.status !== 'SUCCESS' || !tx.label_url || !tx.tracking_number) {
        const msgs = tx.messages?.map(m => m.text).join('; ') ?? `status ${tx.status}`
        throw new Error(`Shippo label purchase failed: ${msgs}`)
    }

    return {
        trackingNumber: tx.tracking_number,
        trackingUrl: tx.tracking_url_provider ?? null,
        labelUrl: tx.label_url,
    }
}
