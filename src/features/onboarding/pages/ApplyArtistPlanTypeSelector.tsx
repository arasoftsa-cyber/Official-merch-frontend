import React from 'react';

type PlanTypeSelectorProps = {
  error?: string;
  value: string;
  onSelect: (value: 'basic' | 'advanced') => void;
};

export default function PlanTypeSelector({ error, value, onSelect }: PlanTypeSelectorProps) {
  return (
    <div className="space-y-3">
      <span className="block text-sm font-medium text-slate-700 dark:text-white/80">Plan Type *</span>
      <div className="grid gap-6 md:grid-cols-3 selection-cards">
        <button
          type="button"
          onClick={() => onSelect('basic')}
          className={`flex flex-col items-center justify-between overflow-hidden rounded-[2rem] p-6 text-center transition-all ${value === 'basic'
            ? 'ring-4 ring-white/50 bg-indigo-200 shadow-xl'
            : 'bg-indigo-100 hover:bg-indigo-200/80 shadow-md'
            }`}
          style={{
            minHeight: '340px',
            position: 'relative',
            borderTopRightRadius: value === 'basic' ? '2rem' : '4rem',
          }}
        >
          {value !== 'basic' && (
            <div className="absolute top-[-10px] right-[-10px] h-16 w-16 rounded-bl-full bg-indigo-300 opacity-50" />
          )}
          <div className="relative z-10 w-full">
            <p className="text-sm font-medium tracking-wide text-black/60">On Demand Artist Plan</p>
            <p className="mt-1 text-lg font-bold text-gray-800">Basic</p>
            <h3 className="mt-2 text-4xl font-bold text-gray-900">Free</h3>
            <div className="mx-auto mt-6 flex w-fit flex-col items-start space-y-2.5 text-[13px] font-medium text-gray-700">
              <p className="flex items-center gap-2"><span className="rounded-full bg-indigo-300 p-0.5 text-[10px] text-white">&#10003;</span> 1 Design</p>
              <p className="flex items-center gap-2"><span className="rounded-full bg-indigo-300 p-0.5 text-[10px] text-white">&#10003;</span> Artist Portal</p>
              <p className="flex items-center gap-2 opacity-50"><span className="rounded-full bg-gray-200 p-0.5 text-[10px] text-gray-400">&#8226;</span> No Drops</p>
              <p className="flex items-center gap-2 opacity-50"><span className="rounded-full bg-gray-200 p-0.5 text-[10px] text-gray-400">&#8226;</span> No Shelf &amp; Wall Of Fans</p>
            </div>
          </div>
          <div className="relative z-10 mt-8 w-full">
            <div className="mx-auto w-[60%] rounded-full bg-white py-2 text-sm font-bold text-gray-800 shadow-sm">
              Enroll
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onSelect('advanced')}
          className={`relative z-10 flex transform flex-col items-center justify-between overflow-hidden rounded-[2rem] p-6 text-center transition-all ${value === 'advanced'
            ? 'scale-105 bg-indigo-400 shadow-2xl ring-4 ring-white'
            : 'bg-indigo-400/90 shadow-lg hover:scale-[1.02]'
            }`}
          style={{
            minHeight: '380px',
            borderBottomRightRadius: value === 'advanced' ? '2rem' : '4rem',
          }}
        >
          {value !== 'advanced' && (
            <div className="absolute bottom-[-15px] right-[-15px] h-[110%] w-[110%] rounded-[2rem] bg-indigo-500 opacity-70" />
          )}
          <div className="w-full pt-2">
            <p className="text-sm font-medium tracking-wide text-white/80">On Demand Artist Plan</p>
            <p className="mt-1 text-xl font-bold text-white">Advanced</p>
            <div className="mt-2 flex flex-col items-center justify-center">
              <h3 className="flex items-start justify-center text-4xl font-bold text-white">
                <span className="mr-1 mt-1 text-xl font-semibold opacity-80">&#8377;</span>
                999
              </h3>
              <p className="mt-0.5 text-xs text-indigo-100">/ year</p>
            </div>
            <div className="mx-auto mt-6 flex w-fit flex-col items-start space-y-3 text-sm font-medium text-white">
              <p className="flex items-center gap-2"><span className="p-0.5 font-bold text-white">&#10003;</span> Up to 4 Designs</p>
              <p className="flex items-center gap-2"><span className="p-0.5 font-bold text-white">&#10003;</span> Artist Portal</p>
              <p className="flex items-center gap-2"><span className="p-0.5 font-bold text-white">&#10003;</span> Drops</p>
              <p className="flex items-center gap-2 opacity-60"><span className="rounded-full bg-indigo-500 p-0.5 text-[8px] font-bold text-indigo-200">&#8226;</span> No Shelf &amp; Wall Of Fans</p>
            </div>
          </div>
          <div className="relative z-10 mb-2 mt-auto w-full">
            <div className="mx-auto w-[70%] rounded-full bg-white py-2.5 text-sm font-bold text-gray-900 shadow-md">
              Enroll
            </div>
          </div>
        </button>

        <button
          type="button"
          className="relative flex cursor-not-allowed flex-col items-center justify-between overflow-hidden rounded-[2rem] bg-zinc-700 p-6 text-center opacity-50 transition-all"
          disabled
          style={{
            minHeight: '340px',
            borderBottomRightRadius: '4rem',
          }}
        >
          <div className="absolute bottom-[-10px] right-[-10px] h-[105%] w-[105%] rounded-[2rem] bg-black opacity-60" />
          <div className="w-full">
            <p className="text-sm font-medium tracking-wide text-white/60">On Demand Artist Plan</p>
            <p className="mt-1 text-lg font-bold text-white">Premium</p>
            <div className="mt-2 flex flex-col items-center justify-center">
              <h3 className="flex items-start justify-center text-4xl font-bold text-white">
                <span className="mr-1 mt-1 text-lg font-semibold opacity-60">&#8377;</span>
                1999
              </h3>
              <p className="mt-0.5 text-xs text-zinc-400">/ year</p>
            </div>

            <div className="mx-auto mt-6 flex w-fit flex-col items-start space-y-2.5 text-[13px] font-medium text-gray-300">
              <p className="flex items-center gap-2"><span className="flex items-center justify-center p-0.5 text-zinc-400">&#10003;</span> Up to 7 Designs</p>
              <p className="flex items-center gap-2"><span className="flex items-center justify-center p-0.5 text-zinc-400">&#10003;</span> Artist Portal</p>
              <p className="flex items-center gap-2"><span className="flex items-center justify-center p-0.5 text-zinc-400">&#10003;</span> Drops</p>
              <p className="flex items-center gap-2"><span className="flex items-center justify-center p-0.5 text-zinc-400">&#10003;</span> Shelf &amp; Wall Of Fans</p>
            </div>
          </div>
          <div className="relative z-10 mt-8 w-full">
            <div className="relative mx-auto w-[60%] overflow-hidden rounded-full border border-white/20 bg-white">
              <div className="absolute inset-0 z-0 bg-white/10" />
              <p className="relative z-10 py-2 text-sm font-bold text-gray-800">Enroll</p>
            </div>
            <p className="mt-2 text-xs font-medium text-rose-300 opacity-80">(Coming soon)</p>
          </div>
        </button>
      </div>
      {error && <p className="text-xs text-rose-300">{error}</p>}
    </div>
  );
}
