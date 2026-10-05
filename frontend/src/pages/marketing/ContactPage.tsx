import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  Mail,
  Phone,
  MapPin,
  MessageSquare,
  Sparkles,
  Send,
  Loader2,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import { SeoHead } from '../../components/seo/SeoHead';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/card';
import {
  ContactFormSchema,
  type ContactFormData,
  submitContactForm,
} from '../../lib/contactService';

export function ContactPage() {
  const [submitted, setSubmitted] = React.useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormData>({
    resolver: zodResolver(ContactFormSchema),
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      company: '',
      interestedApp: 'bundle',
      message: '',
    },
  });

  const onSubmit = async (data: ContactFormData) => {
    try {
      const res = await submitContactForm(data);
      toast.success(res.message);
      setSubmitted(true);
      reset();
    } catch {
      toast.error('Failed to send your message. Please check the fields and try again.');
    }
  };

  return (
    <>
      <SeoHead
        title="Contact Orvio Hub — Lagos Office, Sales & Support"
        description="Speak with an Orvio business specialist. Get live onboarding assistance for your supermarket, pharmacy, or gym in Nigeria."
        keywords={['Contact Orvio', 'Orvio phone Lagos', 'Orvio customer support', 'Orvio WhatsApp']}
      />

      <div className="space-y-20 py-12">
        {/* Contact Hero */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <Badge variant="glow" className="mb-4">
            <MessageSquare className="h-3.5 w-3.5 mr-1" />
            We Are Here to Help
          </Badge>
          <h1 className="text-4xl sm:text-6xl font-black text-slate-900 tracking-tight max-w-4xl mx-auto leading-tight">
            Let's Talk About Your <span className="gradient-text">Business Operations</span>
          </h1>
          <p className="mt-4 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Whether you want a customized multi-branch rollout, need staff onboarding support, or have technical questions, our Lagos team is ready.
          </p>
        </section>

        {/* Contact Grid (Form + Details) */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            {/* Left: Contact Info & WhatsApp */}
            <div className="lg:col-span-5 space-y-6">
              <Card className="bg-slate-950 text-white border-slate-800 p-6 sm:p-8">
                <CardHeader className="p-0 pb-6 border-b border-slate-800">
                  <Badge variant="glow" className="bg-indigo-900/80 text-indigo-300 w-fit">
                    Direct Assistance
                  </Badge>
                  <CardTitle className="text-2xl font-bold text-white mt-2">
                    Lagos Headquarters
                  </CardTitle>
                  <CardDescription className="text-slate-400 text-xs mt-1">
                    Available Monday to Saturday, 8:00 AM – 7:00 PM WAT
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-0 pt-6 space-y-6 text-sm text-slate-300">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-indigo-400 border border-slate-800">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <div>
                      <strong className="text-white block">Office Address:</strong>
                      <span className="text-xs text-slate-400">
                        Adeola Odeku Street, Victoria Island, Lagos State, Nigeria
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-emerald-400 border border-slate-800">
                      <Phone className="h-5 w-5" />
                    </div>
                    <div>
                      <strong className="text-white block">Phone Line:</strong>
                      <a href="tel:+23480000ORVIO" className="text-xs text-emerald-400 hover:underline">
                        +234 (0) 800 00 ORVIO
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-sky-400 border border-slate-800">
                      <Mail className="h-5 w-5" />
                    </div>
                    <div>
                      <strong className="text-white block">Direct Email:</strong>
                      <a href="mailto:hello@orvio.com" className="text-xs text-sky-400 hover:underline">
                        hello@orvio.com
                      </a>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-800 space-y-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                      Need Instant Answers?
                    </span>
                    <a
                      href="https://wa.me/2348000000000?text=Hi%20Orvio%20Support%2C%20I%20have%20an%20inquiry%20regarding%20Orvio%20Hub"
                      target="_blank"
                      rel="noreferrer"
                      className="block"
                    >
                      <Button variant="emerald" size="lg" className="w-full font-bold">
                        <MessageSquare className="h-4 w-4" />
                        <span>Chat With Sales on WhatsApp</span>
                      </Button>
                    </a>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right: Contact Form */}
            <div className="lg:col-span-7">
              <Card className="border-slate-200/90 bg-white p-6 sm:p-10 shadow-sm">
                {submitted ? (
                  <div className="text-center py-12 space-y-4 animate-in fade-in">
                    <div className="h-16 w-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="h-8 w-8" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900">Message Received!</h3>
                    <p className="text-sm text-slate-600 max-w-md mx-auto">
                      Thank you for contacting Orvio Hub. An account specialist in Lagos has received your details and will call or message you shortly.
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => setSubmitted(false)}
                      className="mt-4"
                    >
                      Send Another Message
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <div>
                      <h3 className="text-2xl font-bold text-slate-900">Send Us an Inquiry</h3>
                      <p className="text-xs text-slate-500 mt-1">
                        Fill out the form below and our team will get back to you in under 2 hours.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-700">Full Name *</label>
                        <Input
                          placeholder="e.g. Adebayo Adeleke"
                          {...register('fullName')}
                          className={errors.fullName ? 'border-rose-500' : ''}
                        />
                        {errors.fullName && (
                          <span className="text-[11px] text-rose-500">{errors.fullName.message}</span>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-700">Business Email *</label>
                        <Input
                          type="email"
                          placeholder="e.g. adebayo@company.ng"
                          {...register('email')}
                          className={errors.email ? 'border-rose-500' : ''}
                        />
                        {errors.email && (
                          <span className="text-[11px] text-rose-500">{errors.email.message}</span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-700">WhatsApp / Phone *</label>
                        <Input
                          placeholder="e.g. 08012345678"
                          {...register('phone')}
                          className={errors.phone ? 'border-rose-500' : ''}
                        />
                        {errors.phone && (
                          <span className="text-[11px] text-rose-500">{errors.phone.message}</span>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-700">Company / Store Name *</label>
                        <Input
                          placeholder="e.g. PrimeMart Supermarket"
                          {...register('company')}
                          className={errors.company ? 'border-rose-500' : ''}
                        />
                        {errors.company && (
                          <span className="text-[11px] text-rose-500">{errors.company.message}</span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700">
                        What App(s) Are You Interested In? *
                      </label>
                      <select
                        {...register('interestedApp')}
                        className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      >
                        <option value="bundle">All-in-One Enterprise Bundle (Inventory + Gym + SSO)</option>
                        <option value="inventory">Orvio Inventory & POS only</option>
                        <option value="gym">Orvio Gym Management only</option>
                        <option value="general">General Inquiry / Partnership</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700">Your Message *</label>
                      <Textarea
                        placeholder="Tell us about your branches, current challenges, or specific requirements..."
                        {...register('message')}
                        className={errors.message ? 'border-rose-500' : ''}
                      />
                      {errors.message && (
                        <span className="text-[11px] text-rose-500">{errors.message.message}</span>
                      )}
                    </div>

                    <Button
                      type="submit"
                      variant="primary"
                      size="xl"
                      disabled={isSubmitting}
                      className="w-full font-bold shadow-indigo-600/25"
                    >
                      {isSubmitting ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          <Send className="h-5 w-5" />
                          <span>Submit Request</span>
                        </>
                      )}
                    </Button>
                  </form>
                )}
              </Card>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
