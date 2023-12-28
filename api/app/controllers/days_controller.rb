class DaysController < ApplicationController
  before_action :find_cycle, only: [:create]
  before_action :find_day, only: [:show, :update, :destroy]
  before_action :find_days, only: [:index, :filter]

  def index
    authorize @days
    render json: @days
  end

  def show
    authorize @day
    render json: @day
  end

  def filter
    @days = @days.where(id: permitted_attributes(resource_class)[:id]) if params[:filter].key?(:id)

    authorize @days
    render json: @days
  end

  def create
    @day = resource_class.new create_params

    if @day.save
      authorize @day
      render json: @day, status: :created, location: @day
    else
      skip_authorization
      render json: @day.errors, status: :unprocessable_entity
    end
  end

  def update
    throw NotImplementedError
  end

  def destroy
    throw NotImplementedError
  end

  protected

  def create_params
    permitted_attributes(resource_class).merge(
      user: current_user,
      cycle: @cycle
    )
  end

  def update_params
    permitted_attributes(@day)
  end

  def find_cycle
    @cycle = policy_scope(Cycle).find_by(id: params.dig(:data, :relationships, :cycle, :data, :id))
  end

  def find_day
    @day = policy_scope(resource_class).find(params[:id])
  end

  def find_days
    @days = policy_scope(resource_class)
  end
end
