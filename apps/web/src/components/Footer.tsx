import { Heart } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border px-6 py-4">
      <p className="text-center text-sm text-muted-foreground">
        Built with <Heart className="inline-block h-3.5 w-3.5 fill-red-500 text-red-500" /> by{" "}
        <a
          href="https://habibium.com"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-primary hover:underline"
        >
          habibium
        </a>
      </p>
    </footer>
  );
}
