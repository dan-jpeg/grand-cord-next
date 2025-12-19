import Stripe from 'stripe'

const stripe = new Stripe('sk_test_51Sfmq1RzkZAWuVTgzcoTcjLSTP34GPRROhw4YTKNFjmBg6SaX5l43ez3br1Y7r97EXfpzwrtRe8m7Ppa9q49lqbH00bYg5z8Xj')

async function test() {
    const product = await stripe.products.create({
        name: 'Starter Subscription',
        description: '$12/Month subscription',
    })

    const price = await stripe.prices.create({
        unit_amount: 1200,
        currency: 'usd',
        recurring: {
            interval: 'month',
        },
        product: product.id,
    })

    console.log('Success! Product id:', product.id)
    console.log('Success! Price id:', price.id)
}

test()