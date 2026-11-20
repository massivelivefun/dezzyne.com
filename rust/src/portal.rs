use std::f32::consts::TAU;

use crate::grid::GridCamera;
use crate::spring::Spring;

pub const PORTAL_FLOATS: usize = 12;
pub const MAX_RINGS: usize = 8;
pub const RING_FLOATS: usize = MAX_RINGS * 2;
pub const PARTICLE_COUNT: usize = 72;
pub const PARTICLE_FLOATS: usize = 8;

// Parent scale for the entire portal assembly (set to 1.0 to revert)
const PORTAL_SCALE: f32 = 1.25;

const PORTAL_Z: f32 = 4.35;
const PORTAL_CENTER_Y: f32 = -0.613;
const PORTAL_HALF_W: f32 = 0.51 * PORTAL_SCALE;
const PORTAL_HALF_H: f32 = 0.74 * PORTAL_SCALE;
const RING_DURATION: f32 = 0.58;

#[derive(Clone, Copy)]
struct Particle {
    angle: f32,
    dist: f32,
    speed: f32,
    size: f32,
    shade: f32,
    phase: f32,
    is_streak: bool,
}

impl Particle {
    const fn zero() -> Self {
        Self {
            angle: 0.0,
            dist: 1.4,
            speed: 0.3,
            size: 3.0,
            shade: 0.0,
            phase: 0.0,
            is_streak: false,
        }
    }
}

pub struct Portal {
    enabled: bool,
    hovered: bool,
    elapsed: f32,
    scale: Spring,
    instance_id: u32,
    player_count: u32,
    rng_state: u32,
    ring_ages: [f32; MAX_RINGS],
    particles: [Particle; PARTICLE_COUNT],
    portal_buf: [f32; PORTAL_FLOATS],
    ring_buf: [f32; RING_FLOATS],
    particle_buf: [f32; PARTICLE_COUNT * PARTICLE_FLOATS],
}

impl Portal {
    pub const fn new() -> Self {
        Self {
            enabled: false,
            hovered: false,
            elapsed: 0.0,
            scale: Spring::new(0.0),
            instance_id: 48291,
            player_count: 64,
            rng_state: 0x9e37_79b9,
            ring_ages: [-1.0; MAX_RINGS],
            particles: [Particle::zero(); PARTICLE_COUNT],
            portal_buf: [0.0; PORTAL_FLOATS],
            ring_buf: [0.0; RING_FLOATS],
            particle_buf: [0.0; PARTICLE_COUNT * PARTICLE_FLOATS],
        }
    }

    fn next_u32(&mut self) -> u32 {
        let mut x = self.rng_state;
        if x == 0 {
            x = 0x9e37_79b9;
        }
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        self.rng_state = x;
        x
    }

    fn rand01(&mut self) -> f32 {
        (self.next_u32() >> 8) as f32 * (1.0 / 16_777_216.0)
    }

    pub fn spawn_ring(&mut self) {
        let mut target_idx: usize = 0;
        let mut oldest_age: f32 = -1.0;
        let mut found_free = false;

        for i in 0..MAX_RINGS {
            if self.ring_ages[i] < 0.0 {
                target_idx = i;
                found_free = true;
                break;
            }
            if self.ring_ages[i] > oldest_age {
                oldest_age = self.ring_ages[i];
                target_idx = i;
            }
        }

        if found_free || oldest_age >= 0.0 {
            self.ring_ages[target_idx] = 0.0;
        }
    }

    fn spawn_particle(&mut self, idx: usize, initial_spread: bool) {
        let angle = self.rand01() * TAU;
        let is_streak = self.rand01() < 0.42;
        let dist = if initial_spread {
            0.14 + self.rand01() * 1.62
        } else {
            1.10 + self.rand01() * 0.72
        };

        let (speed, size) = if is_streak {
            (0.54 + self.rand01() * 0.30, 1.8 + self.rand01() * 1.1)
        } else {
            (0.22 + self.rand01() * 0.16, 2.5 + self.rand01() * 2.1)
        };

        let shade = self.rand01();
        let phase = self.rand01() * TAU;

        self.particles[idx] = Particle {
            angle,
            dist,
            speed,
            size,
            shade,
            phase,
            is_streak,
        };
    }

    pub fn init(&mut self, enabled: bool, rng_seed: u32) {
        self.enabled = enabled;
        self.hovered = false;
        self.rng_state = if rng_seed == 0 {
            0x9e37_79b9
        } else {
            rng_seed
        };

        if enabled {
            self.instance_id = 10000 + (self.next_u32() % 90000);
            self.player_count = 56 + (self.next_u32() % 19);
            self.elapsed = 0.0;
            self.scale.pos = 0.04;
            self.scale.vel = 0.0;
            self.scale.target = 1.0;
            self.ring_ages = [-1.0; MAX_RINGS];
            self.spawn_ring();
            for i in 0..PARTICLE_COUNT {
                self.spawn_particle(i, true);
            }
        } else {
            self.scale.snap(0.0);
            self.ring_ages = [-1.0; MAX_RINGS];
        }
    }

    pub fn hit_test(&self, x: f32, y: f32) -> bool {
        if !self.enabled {
            return false;
        }
        let rx = self.portal_buf[2];
        let ry = self.portal_buf[3];
        if rx <= 1.0 || ry <= 1.0 {
            return false;
        }
        let dx = (x - self.portal_buf[0]) / rx;
        let dy = (y - self.portal_buf[1]) / ry;
        (dx * dx + dy * dy) <= 1.0
    }

    pub fn clear_hover(&mut self) {
        self.hovered = false;
    }

    pub fn click(&mut self, x: f32, y: f32) -> bool {
        self.hit_test(x, y)
    }

    #[allow(clippy::too_many_arguments)]
    pub fn step(
        &mut self,
        safe_dt: f32,
        motion_scale: f32,
        time: f32,
        width: f32,
        height: f32,
        mouse_x: f32,
        mouse_y: f32,
        pointer_active: bool,
        grid_cam: &GridCamera,
    ) {
        if !self.enabled {
            self.hovered = false;
            self.portal_buf[6] = 0.0;
            return;
        }

        self.elapsed = (self.elapsed + safe_dt).min(3600.0);

        if motion_scale <= 0.001 {
            self.scale.snap(1.0);
        } else {
            self.scale.step(safe_dt, 145.0, 17.5);
        }

        // Compact 3D XZ ring expanding slightly past the rim and fading fast
        for i in 0..MAX_RINGS {
            let base = i * 2;
            let age = self.ring_ages[i];
            if age < 0.0 || motion_scale <= 0.001 {
                if motion_scale <= 0.001 {
                    self.ring_ages[i] = -1.0;
                }
                self.ring_buf[base] = 0.0;
                self.ring_buf[base + 1] = 0.0;
            } else {
                let next_age = age + safe_dt * motion_scale;
                if next_age >= RING_DURATION {
                    self.ring_ages[i] = -1.0;
                    self.ring_buf[base] = 0.0;
                    self.ring_buf[base + 1] = 0.0;
                } else {
                    self.ring_ages[i] = next_age;
                    let prog = (next_age / RING_DURATION).clamp(0.0, 1.0);
                    let inv = 1.0 - prog;
                    let ease = 1.0 - inv * inv;
                    let radius = (0.16 + ease * 1.12) * PORTAL_SCALE;
                    let ramp = (prog * 10.0).clamp(0.0, 1.0);
                    let alpha = inv * inv * inv * ramp;
                    self.ring_buf[base] = radius;
                    self.ring_buf[base + 1] = alpha;
                }
            }
        }

        let w = width.max(1.0);
        let (portal_cx, portal_cy, proj) = grid_cam.project_world_point(
            0.0,
            PORTAL_CENTER_Y,
            PORTAL_Z,
            w,
            height,
        );

        let scale = self.scale.pos.clamp(0.0, 1.15);
        let mut base_rx = PORTAL_HALF_W * proj;
        let max_rx = w * (0.25 * PORTAL_SCALE);
        if base_rx > max_rx {
            base_rx = max_rx;
        }
        let base_ry = base_rx * (PORTAL_HALF_H / PORTAL_HALF_W);

        let portal_rx = base_rx * scale;
        let portal_ry = base_ry * scale;

        self.portal_buf[0] = portal_cx;
        self.portal_buf[1] = portal_cy;
        self.portal_buf[2] = portal_rx;
        self.portal_buf[3] = portal_ry;

        self.portal_buf[4] = 0.0;
        self.portal_buf[5] = PORTAL_Z;
        self.portal_buf[6] = 1.0;
        self.portal_buf[7] = PORTAL_CENTER_Y;

        self.portal_buf[8] = time;
        self.portal_buf[9] = scale.clamp(0.0, 1.0);
        self.portal_buf[10] = PORTAL_SCALE;
        self.portal_buf[11] = 0.0;

        if pointer_active {
            self.hovered = self.hit_test(mouse_x, mouse_y);
        } else {
            self.hovered = false;
        }

        // Straight-line radial convergence directly into the portal center
        for i in 0..PARTICLE_COUNT {
            let mut p = self.particles[i];
            let accel = if p.is_streak {
                0.65 + 0.60 / (p.dist + 0.30)
            } else {
                0.55 + 0.32 / (p.dist + 0.36)
            };
            let pull = p.speed * accel;
            p.dist -= pull * safe_dt * motion_scale;

            if p.dist <= 0.06 {
                self.spawn_particle(i, false);
                p = self.particles[i];
            } else {
                self.particles[i] = p;
            }

            let (sa, ca) = p.angle.sin_cos();
            let sx = portal_cx + ca * p.dist * base_rx;
            let sy = portal_cy + sa * p.dist * base_ry;

            let vx_p = -ca * base_rx;
            let vy_p = -sa * base_ry;
            let v_len = (vx_p * vx_p + vy_p * vy_p).sqrt().max(1e-4);
            let dir_x = vx_p / v_len;
            let dir_y = vy_p / v_len;

            let fade_in = ((1.82 - p.dist) / 0.44).clamp(0.0, 1.0);
            let fade_out = ((p.dist - 0.06) / 0.30).clamp(0.0, 1.0);
            let twinkle = if p.is_streak {
                0.96
            } else {
                let tw_arg = time * 4.2 + p.phase * 3.0;
                0.80 + 0.20 * tw_arg.sin()
            };
            let alpha = fade_in * fade_out * twinkle * scale.clamp(0.0, 1.0);

            let (stretch, tint_code) = if p.is_streak {
                let warp = (1.35 / (p.dist + 0.30)).clamp(0.0, 2.8);
                let s_len = 1.0 + (3.6 + warp) * motion_scale.clamp(0.0, 1.0);
                (s_len, 1.0 + p.shade)
            } else {
                (1.0, p.shade * 0.45)
            };

            let base = i * PARTICLE_FLOATS;
            self.particle_buf[base] = sx;
            self.particle_buf[base + 1] = sy;
            self.particle_buf[base + 2] = dir_x;
            self.particle_buf[base + 3] = dir_y;
            self.particle_buf[base + 4] = p.size * PORTAL_SCALE;
            self.particle_buf[base + 5] = stretch;
            self.particle_buf[base + 6] = alpha;
            self.particle_buf[base + 7] = tint_code;
        }
    }

    pub fn is_hovered(&self) -> bool {
        self.hovered
    }

    pub fn hovered_floor_anchor(&self) -> Option<(f32, f32)> {
        if self.enabled && self.hovered {
            Some((0.0, PORTAL_Z))
        } else {
            None
        }
    }

    pub fn instance_id(&self) -> u32 {
        self.instance_id
    }

    pub fn player_count(&self) -> u32 {
        self.player_count
    }

    pub fn countdown_sec(&self) -> u32 {
        if self.elapsed >= 30.0 {
            0
        } else {
            let whole = (self.elapsed.floor() as u32).min(30);
            30 - whole
        }
    }

    pub fn portal_ptr(&self) -> *const f32 {
        self.portal_buf.as_ptr()
    }

    pub fn rings_ptr(&self) -> *const f32 {
        self.ring_buf.as_ptr()
    }

    pub fn particles_ptr(&self) -> *const f32 {
        self.particle_buf.as_ptr()
    }

    pub const fn particle_count(&self) -> usize {
        PARTICLE_COUNT
    }
}
