import Image from "next/image";
import { Button } from "../components/ui/button.jsx";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "../components/ui/card.jsx";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "../components/ui/accordion.jsx";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuIndicator,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  NavigationMenuViewport,
} from "../components/ui/navigation-menu";
import { Sparkles, Star, CheckCircle } from "lucide-react";

// Import the client-side wrapper for VirtualTryOn
import VirtualTryOnWrapper from "../components/VirtualTryOnWrapper";

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      {/* Sticky Navigation Menu */}
      <nav className="fixed top-0 left-0 w-full bg-white">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-primary">Fyuse</h1>
          <NavigationMenu>
            <NavigationMenuList className="flex flex-row">
              <NavigationMenuItem className="basis-64">
                <NavigationMenuLink className="text-black basis-64" href="/">
                  Home
                </NavigationMenuLink>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <NavigationMenuLink
                  className="text-black basis-64"
                  href="/features"
                >
                  Features
                </NavigationMenuLink>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <NavigationMenuLink
                  className="text-black basis-64"
                  href="/about"
                >
                  About
                </NavigationMenuLink>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <NavigationMenuLink
                  className="text-black basis-64"
                  href="/contact"
                >
                  Contact
                </NavigationMenuLink>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-20">
        {/* Hero Section */}
        <section className="container mx-auto px-4 py-16 text-center bg-gradient-to-r from-purple-700 to-pink-400 rounded-xl">
          <h1 className="text-5xl font-bold tracking-tight text-white sm:text-6xl">
            Welcome to Fyuse
          </h1>
          <p className="mt-4 text-lg text-white leading-relaxed">
            The easiest way to manage your projects and collaborate with your
            team.
          </p>
          <div className="mt-8">
            <Button className="rounded-md bg-primary px-6 py-3 text-black transition-all hover:bg-primary/90 bg-white">
              Get Started
            </Button>
          </div>
        </section>

        {/* Virtual Try-On Feature */}
        <section className="container mx-auto px-4 py-16">
          <VirtualTryOnWrapper />
        </section>

        {/* Features Section */}
        <section className="container mx-auto px-4 py-16">
          <h2 className="mb-8 text-center text-3xl font-bold text-primary">
            Features
          </h2>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {/* Feature 1 */}
            <div className="flex flex-col items-center space-y-4">
              <div className="rounded-full bg-gradient-to-r from-purple-700 to-pink-400 p-4 text-white">
                <Sparkles className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-semibold text-primary">
                Feature One
              </h3>
              <p className="text-center text-muted-foreground leading-relaxed">
                Description of the first feature.
              </p>
            </div>
            {/* Feature 2 */}
            <div className="flex flex-col items-center space-y-4">
              <div className="rounded-full bg-primary p-4 bg-gradient-to-r from-purple-700 to-pink-400 text-white">
                <Star className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-semibold text-primary">
                Feature Two
              </h3>
              <p className="text-center text-muted-foreground leading-relaxed">
                Description of the second feature.
              </p>
            </div>
            {/* Feature 3 */}
            <div className="flex flex-col items-center space-y-4">
              <div className="rounded-full bg-primary p-4 bg-gradient-to-r from-purple-700 to-pink-400 text-white">
                <CheckCircle className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-semibold text-primary">
                Feature Three
              </h3>
              <p className="text-center text-muted-foreground leading-relaxed">
                Description of the third feature.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="container mx-auto px-4 py-16">
          <h2 className="mb-8 text-center text-3xl font-bold text-primary">
            FAQ
          </h2>
          <Accordion type="single" collapsible>
            <AccordionItem value="item-1">
              <AccordionTrigger className="text-black">
                What is Fyuse?
              </AccordionTrigger>
              <AccordionContent className="text-black">
                Fyuse is a platform to manage your projects and collaborate with
                your team efficiently.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger className="text-black">
                How secure is my data?
              </AccordionTrigger>
              <AccordionContent className="text-black">
                We use state-of-the-art security measures to ensure your data is
                safe and secure.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </section>

        {/* Testimonials Section */}
        <section className="container mx-auto px-4 py-16">
          <h2 className="mb-8 text-center text-3xl font-bold text-primary">
            Testimonials
          </h2>
          <div className="flex flex-col items-center">
            <Card className="max-w-md">
              <CardHeader>
                <CardTitle>John Doe</CardTitle>
              </CardHeader>
              <CardContent>
                Fyuse has transformed the way we manage our projects. Highly
                recommended!
              </CardContent>
              <CardFooter>
                <p className="text-sm text-muted-foreground">CEO, Company</p>
              </CardFooter>
            </Card>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 bg-background text-center text-muted-foreground">
        <p>&copy; 2023 Fyuse. All rights reserved.</p>
        <div className="mt-4 flex justify-center space-x-4">
          <a href="#" className="text-primary hover:text-primary/90">
            Facebook
          </a>
          <a href="#" className="text-primary hover:text-primary/90">
            Twitter
          </a>
          <a href="#" className="text-primary hover:text-primary/90">
            LinkedIn
          </a>
        </div>
      </footer>
    </div>
  );
}
