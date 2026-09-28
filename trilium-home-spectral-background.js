/* Dense Spectral Starfield, adapted from the user's HTML to the Home hero. */
function SpectralBackground() {
    const canvasRef = useRef(null);
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!ctx) return undefined;

        const BEAM_COUNT = 650;
        const DUST_COUNT = 450;
        const FAR_STARS_COUNT = 1200;
        const VISUAL_SCALE = 2;
        const SPEED = 3.6;
        const FOV = 280;
        const MAX_DEPTH = 1800;
        const SPECTRAL_HUES = [185, 205, 220, 245, 275, 310, 36, 155];
        const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || false;
        let width = 1, height = 1, cx = .5, cy = .5;
        let frame = 0, visible = true, globalTime = 0, resizeObserver, visibilityObserver;

        function resize() {
            const box = canvas.getBoundingClientRect();
            width = Math.max(1, box.width); height = Math.max(1, box.height);
            const scale = Math.min(window.devicePixelRatio || 1, 1.5);
            canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
            ctx.setTransform(scale, 0, 0, scale, 0, 0);
            cx = width / 2; cy = height / 2;
            ctx.fillStyle = "#010206"; ctx.fillRect(0, 0, width, height);
        }

        class SpectralBeam {
            constructor() { this.reset(true); }
            reset(init = false) {
                this.baseAngle = Math.random() * Math.PI * 2;
                this.radius = 120 + Math.random() * 750;
                this.z = init ? Math.random() * MAX_DEPTH : MAX_DEPTH;
                this.prevZ = this.z;
                this.hue = SPECTRAL_HUES[Math.floor(Math.random() * SPECTRAL_HUES.length)];
                this.sat = this.hue === 36 ? 75 : 65;
                this.light = 72 + Math.random() * 12;
            }
            update() { this.prevZ = this.z; this.z -= SPEED; if (this.z <= 6) this.reset(false); }
            getAngleAt(z, time) {
                const subtleTwist = Math.pow(1 - z / MAX_DEPTH, 2) * .35;
                return this.baseAngle + time * .03 + subtleTwist;
            }
            draw(time) {
                const angle = this.getAngleAt(this.z, time), currentScale = FOV / this.z;
                const x = Math.cos(angle) * this.radius * currentScale + cx;
                const y = Math.sin(angle) * this.radius * currentScale + cy;
                const tailZ = Math.min(this.prevZ + 16, MAX_DEPTH);
                const tailAngle = this.getAngleAt(tailZ, time), tailScale = FOV / tailZ;
                const tailX = Math.cos(tailAngle) * this.radius * tailScale + cx;
                const tailY = Math.sin(tailAngle) * this.radius * tailScale + cy;
                const midZ = (this.z + tailZ) * .5;
                const midAngle = this.getAngleAt(midZ, time), midScale = FOV / midZ;
                const midX = Math.cos(midAngle) * this.radius * midScale + cx;
                const midY = Math.sin(midAngle) * this.radius * midScale + cy;
                const ratio = 1 - this.z / MAX_DEPTH;
                const alpha = Math.sin(ratio * Math.PI) * .35;
                if (alpha <= 0 || (x < -100 && tailX < -100) || (x > width + 100 && tailX > width + 100) || (y < -100 && tailY < -100) || (y > height + 100 && tailY > height + 100)) return;
                ctx.strokeStyle = `hsla(${this.hue}, ${this.sat}%, ${this.light}%, ${alpha})`;
                ctx.lineWidth = Math.max(.4, ratio * 1.2) * VISUAL_SCALE; ctx.lineCap = "round";
                ctx.beginPath(); ctx.moveTo(tailX, tailY); ctx.quadraticCurveTo(midX, midY, x, y); ctx.stroke();
            }
        }

        class CosmicStar {
            constructor() { this.reset(true); }
            reset(init = false) {
                this.x = (Math.random() - .5) * width * 2.2;
                this.y = (Math.random() - .5) * height * 2.2;
                this.z = init ? Math.random() * MAX_DEPTH : MAX_DEPTH;
                this.hue = SPECTRAL_HUES[Math.floor(Math.random() * SPECTRAL_HUES.length)];
                this.baseSize = .6 + Math.random();
            }
            update() { this.z -= SPEED * .65; if (this.z <= 8) this.reset(false); }
            draw() {
                const scale = FOV / this.z, x = this.x * scale + cx, y = this.y * scale + cy;
                if (x < -20 || x > width + 20 || y < -20 || y > height + 20) return;
                const ratio = 1 - this.z / MAX_DEPTH;
                ctx.fillStyle = `hsla(${this.hue}, 65%, 82%, ${ratio * .5})`;
                ctx.beginPath(); ctx.arc(x, y, Math.max(.5, ratio * this.baseSize) * VISUAL_SCALE, 0, Math.PI * 2); ctx.fill();
            }
        }

        class DeepDust {
            constructor() { this.reset(true); }
            reset(init = false) {
                this.x = (Math.random() - .5) * width * 2.6;
                this.y = (Math.random() - .5) * height * 2.6;
                this.z = init ? Math.random() * MAX_DEPTH : MAX_DEPTH;
                this.alpha = .15 + Math.random() * .3;
                this.hue = SPECTRAL_HUES[Math.floor(Math.random() * SPECTRAL_HUES.length)];
            }
            update() { this.z -= SPEED * .25; if (this.z <= 6) this.reset(false); }
            draw() {
                const scale = FOV / this.z, x = this.x * scale + cx, y = this.y * scale + cy;
                if (x < 0 || x > width || y < 0 || y > height) return;
                const ratio = 1 - this.z / MAX_DEPTH;
                ctx.fillStyle = `hsla(${this.hue}, 50%, 85%, ${this.alpha * ratio})`;
                ctx.fillRect(x, y, VISUAL_SCALE, VISUAL_SCALE);
            }
        }

        resize();
        const beams = Array.from({ length: BEAM_COUNT }, () => new SpectralBeam());
        const stars = Array.from({ length: DUST_COUNT }, () => new CosmicStar());
        const dust = Array.from({ length: FAR_STARS_COUNT }, () => new DeepDust());
        function animate() {
            frame = requestAnimationFrame(animate);
            if (!visible || document.hidden || reducedMotion) return;
            ctx.fillStyle = "rgba(1, 2, 6, 0.24)"; ctx.fillRect(0, 0, width, height);
            globalTime += .01;
            for (const point of dust) { point.update(); point.draw(); }
            for (const point of stars) { point.update(); point.draw(); }
            for (const beam of beams) { beam.update(); beam.draw(globalTime); }
        }
        resizeObserver = new ResizeObserver(resize); resizeObserver.observe(canvas);
        visibilityObserver = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
        visibilityObserver.observe(canvas);
        if (!reducedMotion) animate();
        return () => { cancelAnimationFrame(frame); resizeObserver.disconnect(); visibilityObserver.disconnect(); };
    }, []);
    return <canvas ref={canvasRef} className="ehd-spectral-canvas" aria-hidden="true" />;
}
