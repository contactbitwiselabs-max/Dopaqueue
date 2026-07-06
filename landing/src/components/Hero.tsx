import React from "react";
import { Meteors } from "./ui/meteors";
import { ShimmerButton } from "./ui/shimmer-button";

export const Hero = () => {
  return (
    <div className="relative w-full h-[80vh] flex items-center justify-center overflow-hidden bg-background">
      {/* Meteor effect background */}
      <div className="absolute inset-0 z-0">
        <Meteors number={30} />
      </div>

      <div className="z-10 text-center max-w-4xl mx-auto px-4">
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white mb-6">
          Take control of your <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-500">
            Dopamine.
          </span>
        </h1>
        
        <p className="text-lg md:text-xl text-zinc-400 mb-10 max-w-2xl mx-auto">
          DopaQueue is a privacy-first, local-first extension that gamifies your productivity. Save videos for later, manage your dopamine budget, and reclaim your focus.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <ShimmerButton className="text-white">
            Add to Chrome — It's Free
          </ShimmerButton>
          <button className="px-8 py-3 rounded-md bg-transparent border border-zinc-700 text-zinc-300 hover:bg-zinc-800 transition-colors">
            View on Web
          </button>
        </div>
      </div>

      {/* Decorative gradient blob */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/20 blur-[120px] rounded-full pointer-events-none z-0" />
    </div>
  );
};
