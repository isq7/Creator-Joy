import { Check } from 'lucide-react';
import './PricingScreen.css';

function PricingScreen({ currentPlan = 'Basic', onUpgrade }) {
    const plans = [
        {
            name: 'Basic',
            price: '$0',
            features: [
                'Access to last 24h Outliers',
                '3 Video Searches / day',
                'Basic Script Generation',
                'No Avatar Videos'
            ],
            cta: 'Current Plan',
            isCurrent: true
        },
        {
            name: 'Pro',
            price: '$29',
            period: '/mo',
            features: [
                'Access to ALL Outliers',
                'Unlimited Video Searches',
                'Advanced Title & Thumbnails',
                '10 Avatar Videos / month',
                'Priority Support'
            ],
            cta: 'Upgrade to Pro',
            highlight: true
        },
        {
            name: 'Enterprise',
            price: '$99',
            period: '/mo',
            features: [
                'Everything in Pro',
                'Custom API Access',
                'Dedicated Account Manager',
                'Unlimited Avatar Videos',
                'Custom Branding'
            ],
            cta: 'Contact Sales'
        }
    ];

    return (
        <div className="pricing-screen">
            <header className="pricing-header">
                <h1 className="pricing-title">Simple, transparent pricing</h1>
                <p className="pricing-subtitle">
                    Choose the plan that best fits your content creation needs.
                    Unleash the full potential of viral growth.
                </p>
            </header>

            <div className="pricing-cards">
                {plans.map((plan, index) => (
                    <div
                        key={plan.name}
                        className={`pricing-card ${plan.highlight ? 'popular' : ''}`}
                        style={{ animationDelay: `${index * 100}ms` }}
                    >
                        <div className="plan-name">{plan.name}</div>
                        <div className="plan-price">
                            {plan.price}
                            {plan.period && <span className="plan-period">{plan.period}</span>}
                        </div>

                        <ul className="plan-features">
                            {plan.features.map((feature, i) => (
                                <li key={i} className="feature-item">
                                    <span className="feature-check">
                                        <Check size={18} strokeWidth={3} />
                                    </span>
                                    {feature}
                                </li>
                            ))}
                        </ul>

                        <button
                            className={`cta-button ${plan.highlight ? 'primary' : 'secondary'} ${plan.isCurrent ? 'disabled' : ''}`}
                            onClick={() => !plan.isCurrent && onUpgrade && onUpgrade(plan.name)}
                        >
                            {plan.cta}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default PricingScreen;
