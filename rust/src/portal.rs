use std::f32::consts::TAU;

use glam::{Vec2, Vec3};
use rand::rngs::SmallRng;
use rand::{RngExt, SeedableRng};

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
    rng: SmallRng,
    ring_ages: [f32; MAX_RINGS],
    particles: [Particle; PARTICLE_COUNT],
    portal_buf: [f32; PORTAL_FLOATS],
    ring_buf: [f32; RING_FLOATS],
    particle_buf: [f32; PARTICLE_COUNT * PARTICLE_FLOATS],
}

impl Portal {
    pub fn new() -> Self {
        Self {
            enabled: false,
            hovered: false,
            elapsed: 0.0,
            scale: Spring::new(0.0),
            instance_id: 48291,
            player_count: 64,
            rng: SmallRng::seed_from_u64(0x9e37_79b9_7f4a_7c15),
            ring_ages: [-1.0; MAX_RINGS],
            particles: [Particle::zero(); PARTICLE_COUNT],
            portal_buf: [0.0; PORTAL_FLOATS],
            ring_buf: [0.0; RING_FLOATS],
            particle_buf: [0.0; PARTICLE_COUNT * PARTICLE_FLOATS],
        }
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
        let angle = self.rng.random_range(0.0..TAU);
        let is_streak = self.rng.random_bool(0.42);
        let dist = if initial_spread {
            self.rng.random_range(0.14..1.76)
        } else {
            self.rng.random_range(1.10..1.82)
        };

        let (speed, size) = if is_streak {
            (
                self.rng.random_range(0.54..0.84),
                self.rng.random_range(1.8..2.9),
            )
        } else {
            (
                self.rng.random_range(0.22..0.38),
                self.rng.random_range(2.5..4.6),
            )
        };

        let shade = self.rng.random_range(0.0..1.0);
        let phase = self.rng.random_range(0.0..TAU);

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
        self.rng = SmallRng::seed_from_u64(u64::from(rng_seed));

        if enabled {
            self.instance_id = self.rng.random_range(10_000..=99_999);
            self.player_count = self.rng.random_range(56..=74);
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

    pub fn hit_test(&self, pt: Vec2) -> bool {
        if !self.enabled {
            return false;
        }
        let radii = Vec2::new(self.portal_buf[2], self.portal_buf[3]);
        if radii.x <= 1.0 || radii.y <= 1.0 {
            return false;
        }
        let center = Vec2::new(self.portal_buf[0], self.portal_buf[1]);
        let q = (pt - center) / radii;
        q.length_squared() <= 1.0
    }

    pub fn clear_hover(&mut self) {
        self.hovered = false;
    }

    pub fn click(&mut self, pt: Vec2) -> bool {
        self.hit_test(pt)
    }

    #[allow(clippy::too_many_arguments)]
    pub fn step(
        &mut self,
        safe_dt: f32,
        motion_scale: f32,
        time: f32,
        size: Vec2,
        mouse: Vec2,
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

        let safe_size = size.max(Vec2::ONE);
        let world_center = Vec3::new(0.0, PORTAL_CENTER_Y, PORTAL_Z);
        let (portal_center, proj) =
            grid_cam.project_world_point(world_center, safe_size);

        let scale = self.scale.pos.clamp(0.0, 1.15);
        let max_rx = safe_size.x * (0.25 * PORTAL_SCALE);
        let base_rx = (PORTAL_HALF_W * proj).min(max_rx);
        let base_ry = base_rx * (PORTAL_HALF_H / PORTAL_HALF_W);
        let base_radii = Vec2::new(base_rx, base_ry);
        let portal_radii = base_radii * scale;

        self.portal_buf[0] = portal_center.x;
        self.portal_buf[1] = portal_center.y;
        self.portal_buf[2] = portal_radii.x;
        self.portal_buf[3] = portal_radii.y;

        self.portal_buf[4] = 0.0;
        self.portal_buf[5] = PORTAL_Z;
        self.portal_buf[6] = 1.0;
        self.portal_buf[7] = PORTAL_CENTER_Y;

        self.portal_buf[8] = time;
        self.portal_buf[9] = scale.clamp(0.0, 1.0);
        self.portal_buf[10] = PORTAL_SCALE;
        self.portal_buf[11] = 0.0;

        if pointer_active {
            self.hovered = self.hit_test(mouse);
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

            let radial = Vec2::from_angle(p.angle) * base_radii;
            let pos = portal_center + radial * p.dist;
            let dir = (-radial).normalize_or_zero();

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
            self.particle_buf[base] = pos.x;
            self.particle_buf[base + 1] = pos.y;
            self.particle_buf[base + 2] = dir.x;
            self.particle_buf[base + 3] = dir.y;
            self.particle_buf[base + 4] = p.size * PORTAL_SCALE;
            self.particle_buf[base + 5] = stretch;
            self.particle_buf[base + 6] = alpha;
            self.particle_buf[base + 7] = tint_code;
        }
    }

    pub fn is_hovered(&self) -> bool {
        self.hovered
    }

    pub fn hovered_floor_anchor(&self) -> Option<Vec2> {
        if self.enabled && self.hovered {
            Some(Vec2::new(0.0, PORTAL_Z))
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
