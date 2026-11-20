#[derive(Clone, Copy)]
pub struct Spring {
    pub pos: f32,
    pub vel: f32,
    pub target: f32,
}

impl Spring {
    pub const fn new(val: f32) -> Self {
        Self {
            pos: val,
            vel: 0.0,
            target: val,
        }
    }

    pub fn snap(&mut self, val: f32) {
        self.pos = val;
        self.vel = 0.0;
        self.target = val;
    }

    pub fn step(&mut self, dt: f32, stiffness: f32, damping: f32) {
        let clamped_dt = dt.clamp(0.0, 0.05);
        let sub_dt = clamped_dt * 0.5;
        for _ in 0..2 {
            let delta = self.target - self.pos;
            let force = delta * stiffness - self.vel * damping;
            self.vel += force * sub_dt;
            self.pos += self.vel * sub_dt;
        }
    }
}
