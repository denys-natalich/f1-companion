const TeamColors = (() => {
  const rules = [
    [/mercedes/, "#00d5b8"],
    [/ferrari/, "#e80026"],
    [/red_?bull/, "#1c49ad"],
    [/mclaren/, "#ff8000"],
    [/aston/, "#006b4f"],
    [/alpine/, "#008fff"],
    [/williams/, "#40a0ff"],
    [/^rb$|racing_bulls|alphatauri|toro/, "#3d59a6"],
    [/haas/, "#d9d9dc"],
    [/sauber|audi/, "#ba0a30"],
    [/cadillac/, "#b88a0a"],
  ];
  return {
    color(constructorId) {
      const id = (constructorId || "").toLowerCase();
      for (const [re, color] of rules) {
        if (re.test(id)) return color;
      }
      return "#8c8c94";
    },
  };
})();

const Flags = (() => {
  const map = {
    Bahrain: "🇧🇭", "Saudi Arabia": "🇸🇦", Australia: "🇦🇺", Japan: "🇯🇵",
    China: "🇨🇳", USA: "🇺🇸", "United States": "🇺🇸", Italy: "🇮🇹",
    Monaco: "🇲🇨", Canada: "🇨🇦", Spain: "🇪🇸", Austria: "🇦🇹",
    UK: "🇬🇧", "United Kingdom": "🇬🇧", Hungary: "🇭🇺", Belgium: "🇧🇪",
    Netherlands: "🇳🇱", Azerbaijan: "🇦🇿", Singapore: "🇸🇬", Mexico: "🇲🇽",
    Brazil: "🇧🇷", Qatar: "🇶🇦", UAE: "🇦🇪",
  };
  return { emoji: (country) => map[country] || "🏁" };
})();
