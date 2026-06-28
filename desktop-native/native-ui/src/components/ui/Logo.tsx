interface LogoProps {
  className?: string;
  variant?: "dark" | "light";
}

/**
 * Lynx 产品 Logo - 白色猞猁 + 黑色底
 * 几何化猞猁头像：尖耳+耳簇 / 锐利双眼 / 三角鼻
 */
export function Logo({ className = "w-8 h-8", variant = "dark" }: LogoProps) {
  const bg = variant === "dark" ? "#030816" : "#030816";
  const fg = variant === "dark" ? "#ffffff" : "#ffffff";

  return (
    <svg
      viewBox="0 0 512 512"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="512" height="512" rx="112" fill={bg} />

      {/* 左耳 + 耳簇 */}
      <path
        d="M170 175 L128 70 L185 110 L165 35 L205 75 L195 135 Z"
        fill={fg}
      />
      {/* 右耳 + 耳簇 */}
      <path
        d="M342 175 L384 70 L327 110 L347 35 L307 75 L317 135 Z"
        fill={fg}
      />

      {/* 脸部 */}
      <path
        d="M256 145 C208 145 176 185 170 245 C164 305 186 355 220 380 C235 390 256 395 256 395 C256 395 277 390 292 380 C326 355 348 305 342 245 C336 185 304 145 256 145 Z"
        fill={fg}
      />

      {/* 左眼 */}
      <ellipse
        cx="216"
        cy="250"
        rx="22"
        ry="15"
        fill={bg}
        transform="rotate(-12 216 250)"
      />
      {/* 右眼 */}
      <ellipse
        cx="296"
        cy="250"
        rx="22"
        ry="15"
        fill={bg}
        transform="rotate(12 296 250)"
      />
      {/* 眼睛高光 */}
      <circle cx="221" cy="245" r="4" fill={fg} />
      <circle cx="291" cy="245" r="4" fill={fg} />

      {/* 鼻子 */}
      <path d="M256 290 L240 310 Q256 320 272 310 Z" fill={bg} />

      {/* 嘴 */}
      <path
        d="M256 320 L256 342 M256 342 Q244 350 234 344 M256 342 Q268 350 278 344"
        stroke={bg}
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
