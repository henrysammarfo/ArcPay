use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("GVbnwYVXEVtrNKALkNhzyiQvLErtUnpjQG8J18r3i7iz");

const MAX_AGENT_ID_LEN: usize = 64;
const MAX_PAYMENT_REF_LEN: usize = 96;
const MAX_SHIELD_REF_LEN: usize = 96;
const SECONDS_PER_DAY: i64 = 86_400;

#[program]
pub mod arcpay {
    use super::*;

    /// Initializes an AI agent treasury with immutable owner and spending policy metadata.
    pub fn initialize_treasury(
        ctx: Context<InitializeTreasury>,
        agent_id: String,
        daily_limit: u64,
        max_single_tx: u64,
        min_goldrush_score: u8,
    ) -> Result<()> {
        validate_agent_id(&agent_id)?;
        validate_policy(daily_limit, max_single_tx, min_goldrush_score)?;

        let treasury = &mut ctx.accounts.treasury;
        treasury.owner = ctx.accounts.owner.key();
        treasury.agent_id = agent_id;
        treasury.daily_limit = daily_limit;
        treasury.max_single_tx = max_single_tx;
        treasury.min_goldrush_score = min_goldrush_score;
        treasury.daily_spent = 0;
        treasury.last_reset = Clock::get()?.unix_timestamp;
        treasury.is_active = true;
        treasury.bump = ctx.bumps.treasury;

        emit!(TreasuryInitialized {
            agent_id: treasury.agent_id.clone(),
            owner: treasury.owner,
            daily_limit,
            max_single_tx,
            min_goldrush_score,
        });

        Ok(())
    }

    /// Records an incoming shielded deposit reference after off-chain privacy handling completes.
    pub fn shield_deposit(
        ctx: Context<ShieldDeposit>,
        amount: u64,
        mint: Pubkey,
        shield_ref: String,
    ) -> Result<()> {
        require!(ctx.accounts.treasury.is_active, ArcPayError::TreasuryPaused);
        require!(amount > 0, ArcPayError::InvalidAmount);
        validate_reference(&shield_ref, MAX_SHIELD_REF_LEN)?;

        emit!(ShieldDepositRecorded {
            agent_id: ctx.accounts.treasury.agent_id.clone(),
            owner: ctx.accounts.owner.key(),
            mint,
            amount,
            shield_ref,
        });

        Ok(())
    }

    /// Executes an SPL token payment after enforcing ArcPay treasury risk and spending policy.
    pub fn execute_payment(
        ctx: Context<ExecutePayment>,
        amount: u64,
        goldrush_score: u8,
        payment_ref: String,
    ) -> Result<()> {
        require!(ctx.accounts.treasury.is_active, ArcPayError::TreasuryPaused);
        require!(amount > 0, ArcPayError::InvalidAmount);
        validate_reference(&payment_ref, MAX_PAYMENT_REF_LEN)?;
        require!(goldrush_score <= 100, ArcPayError::InvalidGoldRushScore);

        let treasury = &mut ctx.accounts.treasury;
        reset_daily_spend_if_needed(treasury, Clock::get()?.unix_timestamp)?;
        enforce_payment_policy(treasury, amount, goldrush_score)?;

        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.treasury_token_account.to_account_info(),
                to: ctx.accounts.recipient_token_account.to_account_info(),
                authority: ctx.accounts.owner.to_account_info(),
            },
        );
        token::transfer(cpi_ctx, amount)?;

        treasury.daily_spent = treasury
            .daily_spent
            .checked_add(amount)
            .ok_or(ArcPayError::ArithmeticOverflow)?;

        emit!(PaymentExecuted {
            agent_id: treasury.agent_id.clone(),
            owner: treasury.owner,
            recipient: ctx.accounts.recipient_token_account.owner,
            amount,
            payment_ref,
            goldrush_score,
        });

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(agent_id: String)]
pub struct InitializeTreasury<'info> {
    #[account(
        init,
        payer = owner,
        space = AgentTreasury::space(agent_id.len()),
        seeds = [b"treasury", owner.key().as_ref(), agent_id.as_bytes()],
        bump
    )]
    pub treasury: Account<'info, AgentTreasury>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ShieldDeposit<'info> {
    #[account(
        seeds = [b"treasury", owner.key().as_ref(), treasury.agent_id.as_bytes()],
        bump = treasury.bump,
        has_one = owner @ ArcPayError::UnauthorizedOwner
    )]
    pub treasury: Account<'info, AgentTreasury>,
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct ExecutePayment<'info> {
    #[account(
        mut,
        seeds = [b"treasury", owner.key().as_ref(), treasury.agent_id.as_bytes()],
        bump = treasury.bump,
        has_one = owner @ ArcPayError::UnauthorizedOwner
    )]
    pub treasury: Account<'info, AgentTreasury>,
    pub owner: Signer<'info>,
    #[account(
        mut,
        constraint = treasury_token_account.owner == owner.key() @ ArcPayError::InvalidTokenOwner,
        constraint = treasury_token_account.mint == recipient_token_account.mint @ ArcPayError::TokenMintMismatch
    )]
    pub treasury_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub recipient_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[account]
pub struct AgentTreasury {
    pub owner: Pubkey,
    pub agent_id: String,
    pub daily_limit: u64,
    pub max_single_tx: u64,
    pub min_goldrush_score: u8,
    pub daily_spent: u64,
    pub last_reset: i64,
    pub is_active: bool,
    pub bump: u8,
}

impl AgentTreasury {
    pub fn space(agent_id_len: usize) -> usize {
        8 + 32 + 4 + agent_id_len + 8 + 8 + 1 + 8 + 8 + 1 + 1
    }
}

#[event]
pub struct TreasuryInitialized {
    pub agent_id: String,
    pub owner: Pubkey,
    pub daily_limit: u64,
    pub max_single_tx: u64,
    pub min_goldrush_score: u8,
}

#[event]
pub struct ShieldDepositRecorded {
    pub agent_id: String,
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
    pub shield_ref: String,
}

#[event]
pub struct PaymentExecuted {
    pub agent_id: String,
    pub owner: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub payment_ref: String,
    pub goldrush_score: u8,
}

#[error_code]
pub enum ArcPayError {
    #[msg("Agent ID is empty or too long.")]
    InvalidAgentId,
    #[msg("Amount must be greater than zero.")]
    InvalidAmount,
    #[msg("Daily limit must be greater than zero.")]
    InvalidDailyLimit,
    #[msg("Max single transaction limit must be greater than zero.")]
    InvalidSingleTxLimit,
    #[msg("Max single transaction limit cannot exceed the daily limit.")]
    SingleTxLimitExceedsDailyLimit,
    #[msg("GoldRush score must be between 0 and 100.")]
    InvalidGoldRushScore,
    #[msg("Payment exceeds single transaction limit.")]
    ExceedsSingleTxLimit,
    #[msg("Payment exceeds daily limit.")]
    ExceedsDailyLimit,
    #[msg("Counterparty GoldRush score is below treasury policy.")]
    CounterpartyScoreTooLow,
    #[msg("Treasury is paused.")]
    TreasuryPaused,
    #[msg("Only the treasury owner can perform this action.")]
    UnauthorizedOwner,
    #[msg("Token account is not owned by the treasury owner.")]
    InvalidTokenOwner,
    #[msg("Treasury and recipient token accounts must use the same mint.")]
    TokenMintMismatch,
    #[msg("Reference is empty or too long.")]
    InvalidReference,
    #[msg("Arithmetic overflow.")]
    ArithmeticOverflow,
}

fn validate_agent_id(agent_id: &str) -> Result<()> {
    require!(
        !agent_id.trim().is_empty() && agent_id.len() <= MAX_AGENT_ID_LEN,
        ArcPayError::InvalidAgentId
    );
    Ok(())
}

fn validate_reference(reference: &str, max_len: usize) -> Result<()> {
    require!(
        !reference.trim().is_empty() && reference.len() <= max_len,
        ArcPayError::InvalidReference
    );
    Ok(())
}

fn validate_policy(daily_limit: u64, max_single_tx: u64, min_goldrush_score: u8) -> Result<()> {
    require!(daily_limit > 0, ArcPayError::InvalidDailyLimit);
    require!(max_single_tx > 0, ArcPayError::InvalidSingleTxLimit);
    require!(
        max_single_tx <= daily_limit,
        ArcPayError::SingleTxLimitExceedsDailyLimit
    );
    require!(min_goldrush_score <= 100, ArcPayError::InvalidGoldRushScore);
    Ok(())
}

fn reset_daily_spend_if_needed(treasury: &mut AgentTreasury, now: i64) -> Result<()> {
    let elapsed = now
        .checked_sub(treasury.last_reset)
        .ok_or(ArcPayError::ArithmeticOverflow)?;

    if elapsed >= SECONDS_PER_DAY {
        treasury.daily_spent = 0;
        treasury.last_reset = now;
    }

    Ok(())
}

fn enforce_payment_policy(treasury: &AgentTreasury, amount: u64, goldrush_score: u8) -> Result<()> {
    require!(
        amount <= treasury.max_single_tx,
        ArcPayError::ExceedsSingleTxLimit
    );

    let projected_daily_spend = treasury
        .daily_spent
        .checked_add(amount)
        .ok_or(ArcPayError::ArithmeticOverflow)?;

    require!(
        projected_daily_spend <= treasury.daily_limit,
        ArcPayError::ExceedsDailyLimit
    );
    require!(
        goldrush_score >= treasury.min_goldrush_score,
        ArcPayError::CounterpartyScoreTooLow
    );

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn treasury() -> AgentTreasury {
        AgentTreasury {
            owner: Pubkey::new_unique(),
            agent_id: "ada-research-agent-01".to_string(),
            daily_limit: 5_000,
            max_single_tx: 1_000,
            min_goldrush_score: 70,
            daily_spent: 500,
            last_reset: 1_000,
            is_active: true,
            bump: 255,
        }
    }

    #[test]
    fn valid_policy_allows_payment() {
        let treasury = treasury();

        assert!(enforce_payment_policy(&treasury, 250, 91).is_ok());
    }

    #[test]
    fn rejects_single_transaction_limit_violation() {
        let treasury = treasury();

        assert_eq!(
            enforce_payment_policy(&treasury, 1_001, 91).unwrap_err(),
            error!(ArcPayError::ExceedsSingleTxLimit)
        );
    }

    #[test]
    fn rejects_daily_limit_violation() {
        let mut treasury = treasury();
        treasury.daily_spent = 4_500;

        assert_eq!(
            enforce_payment_policy(&treasury, 600, 91).unwrap_err(),
            error!(ArcPayError::ExceedsDailyLimit)
        );
    }

    #[test]
    fn rejects_low_goldrush_score() {
        let treasury = treasury();

        assert_eq!(
            enforce_payment_policy(&treasury, 250, 69).unwrap_err(),
            error!(ArcPayError::CounterpartyScoreTooLow)
        );
    }

    #[test]
    fn resets_daily_spend_after_one_day() {
        let mut treasury = treasury();

        reset_daily_spend_if_needed(&mut treasury, 1_000 + SECONDS_PER_DAY).unwrap();

        assert_eq!(treasury.daily_spent, 0);
        assert_eq!(treasury.last_reset, 1_000 + SECONDS_PER_DAY);
    }
}
