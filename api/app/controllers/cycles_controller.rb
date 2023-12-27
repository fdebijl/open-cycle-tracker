class CyclesController < ApplicationController
  before_action :find_cycle, only: [:show, :update, :destroy]
  before_action :find_cycles, only: [:index, :filter]

  def index
    authorize @cycles
    render json: @cycles
  end

  def show
    authorize @cycle
    render json: @cycle
  end

  def filter
    @cycles = @cycles.where(id: permitted_attributes(resource_class)[:id]) if params[:filter].key?(:id)
    @cycles = @cycles.last if params[:filter].key?(:current) && params[:filter][:current]

    return render :not_found unless @cycles

    authorize @cycles
    render json: @cycles
  end

  def create
    @cycle = resource_class.new create_params
    authorize @cycle
    @cycle.save!

    if @cycle.save
      render json: @cycle, status: :created, location: @cycle
    else
      render json: @cycle.errors, status: :unprocessable_entity
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
      user: current_user
    )
  end

  def update_params
    permitted_attributes(@cycle)
  end

  def find_cycle
    @cycle = policy_scope(resource_class).find(params[:id])
  end

  def find_cycles
    @cycles = policy_scope(resource_class)
  end
end
